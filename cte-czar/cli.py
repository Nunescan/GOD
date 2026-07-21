"""
CLI unico do CZAR - substitui as paginas separadas do Streamlit por comandos
diretos, chamados pelo painel Cesar Augusto (server/services/cteRunner.js).
Cada comando imprime o progresso no stdout/stderr (capturado ao vivo pelo
painel) e termina com uma linha "RESULT:{...json...}" pro painel conseguir
ler o resultado estruturado sem precisar analisar o log inteiro.

Comandos: processar, relatorio, coletar, pastas-outlook
"""
import argparse
import importlib
import json
import shutil
import sys
import tempfile
from pathlib import Path

# quando o stdout nao e um console de verdade (ex: chamado pelo Node como
# processo filho), o Windows usa cp1252 por padrao, que nao aceita emoji -
# e o codigo inteiro usa emoji em print(). Forca UTF-8 pra nao quebrar.
for _stream in (sys.stdout, sys.stderr):
    if hasattr(_stream, 'reconfigure'):
        _stream.reconfigure(encoding='utf-8', errors='replace')

RAIZ = Path(__file__).parent
sys.path.insert(0, str(RAIZ))

# cada armador aponta pro engine de processamento e pro engine de relatorio -
# os tres tem exatamente a mesma interface (processar_arquivos,
# obter_estatisticas, gerar_relatorio), so mudam classe e modulo
ARMADORES = {
    'alianca': {
        'engine': ('modules.alianca_engine.alianca_engine', 'AliancaEngine'),
        'relatorio': ('modules.alianca_engine.relatorio_engine', 'RelatorioAlianca'),
    },
    'mercosul': {
        'engine': ('modules.mercosul_engine.mercosul_engine', 'MercosulEngine'),
        'relatorio': ('modules.mercosul_engine.relatorio_engine_mc', 'RelatorioMercosul'),
    },
    'norcoast': {
        'engine': ('modules.norcoast_engine.norcoast_engine', 'NorcoastEngine'),
        'relatorio': ('modules.norcoast_engine.relatorio_engine_nc', 'RelatorioNorcoast'),
    },
}


def _load(module_name, class_name):
    module = importlib.import_module(module_name)
    return getattr(module, class_name)


def _print_result(data):
    print("RESULT:" + json.dumps(data, ensure_ascii=False, default=str))


def cmd_processar(args):
    engine_module, engine_class = ARMADORES[args.armador]['engine']
    Engine = _load(engine_module, engine_class)

    origem = Path(args.origem)
    if not origem.exists():
        print(f"Pasta de origem não encontrada: {origem}")
        return 1
    destino = Path(args.destino) if args.destino else RAIZ / "processados" / args.armador / "lote_atual"

    print(f"Processando arquivos de {origem} -> {destino}")
    engine = Engine()
    resultados = engine.processar_arquivos(origem, destino)
    stats = engine.obter_estatisticas(resultados)
    print(f"Concluído: {stats}")
    _print_result({"tipo": "processar", "armador": args.armador, "destino": str(destino), "stats": stats})
    return 0


def cmd_relatorio(args):
    relatorio_module, relatorio_class = ARMADORES[args.armador]['relatorio']
    Relatorio = _load(relatorio_module, relatorio_class)

    pasta_processada = Path(args.pasta)
    if not pasta_processada.exists():
        print(f"Pasta não encontrada: {pasta_processada}")
        return 1

    xmls = list(pasta_processada.rglob("*.xml"))
    if not xmls:
        print("Nenhum XML encontrado nessa pasta.")
        return 1

    print(f"Gerando relatório com {len(xmls)} XMLs...")

    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = Path(tmp)
        for xml in xmls:
            shutil.copy2(xml, tmp_path / xml.name)

        relatorio = Relatorio()
        pasta_relatorios = RAIZ / "processados" / args.armador / "relatorios"
        resultado = relatorio.gerar_relatorio(tmp_path, pasta_relatorios)

    if not resultado:
        print("Falha ao gerar relatório.")
        return 1

    print(f"Relatório gerado: {resultado.get('total_ctes')} CTEs, {resultado.get('total_containers')} containers")
    _print_result({
        "tipo": "relatorio",
        "armador": args.armador,
        "total_ctes": resultado.get("total_ctes"),
        "total_containers": resultado.get("total_containers"),
        "excel_path": resultado.get("excel_path"),
    })
    return 0


def cmd_coletar(args):
    from modules.scraping import OutlookScanner
    from modules.download_anexos import DownloadAnexos

    vinculos_path = RAIZ / "config" / "vinculos.json"
    vinculos = {}
    if vinculos_path.exists():
        vinculos = json.loads(vinculos_path.read_text(encoding="utf-8"))

    if not vinculos:
        print("Nenhuma pasta do Outlook vinculada ainda (aba CT-e > Coleta).")
        return 1

    print("Conectando ao Outlook...")
    scanner = OutlookScanner()
    if not scanner.conectar_outlook():
        print("ERRO: não foi possível conectar ao Outlook. Verifique se ele está instalado e aberto.")
        return 1

    downloader = DownloadAnexos(pasta_base=RAIZ / "downloads" / "CTEs")
    total = 0
    resumo = {}
    for armador, pasta in vinculos.items():
        print(f"--- Coletando {armador} (pasta Outlook: {pasta}) ---")
        arquivos = downloader.baixar_todos_anexos_da_pasta(pasta, armador, scanner, dias=args.dias)
        print(f"{armador}: {len(arquivos)} arquivo(s) baixado(s)")
        resumo[armador] = len(arquivos)
        total += len(arquivos)

    print(f"Coleta concluída! Total: {total} arquivos")
    _print_result({"tipo": "coletar", "total": total, "porArmador": resumo, "pasta": str(downloader.pasta_base)})
    return 0


def cmd_pastas_outlook(args):
    from modules.scraping import escanear_pastas_outlook
    print("Escaneando pastas do Outlook...")
    pastas = escanear_pastas_outlook()
    print(f"{len(pastas)} pasta(s) encontrada(s)")
    _print_result({"tipo": "pastasOutlook", "pastas": sorted(pastas)})
    return 0


def main():
    parser = argparse.ArgumentParser(description="CLI do CZAR (CT-e)")
    sub = parser.add_subparsers(dest="comando", required=True)

    p_proc = sub.add_parser("processar", help="Renomeia/organiza PDFs e XMLs de uma pasta")
    p_proc.add_argument("--armador", required=True, choices=list(ARMADORES.keys()))
    p_proc.add_argument("--origem", required=True)
    p_proc.add_argument("--destino")
    p_proc.set_defaults(func=cmd_processar)

    p_rel = sub.add_parser("relatorio", help="Gera o relatório Excel a partir de uma pasta já processada")
    p_rel.add_argument("--armador", required=True, choices=list(ARMADORES.keys()))
    p_rel.add_argument("--pasta", required=True)
    p_rel.set_defaults(func=cmd_relatorio)

    p_col = sub.add_parser("coletar", help="Baixa anexos das pastas do Outlook vinculadas")
    p_col.add_argument("--dias", type=int, default=9999)
    p_col.set_defaults(func=cmd_coletar)

    p_pastas = sub.add_parser("pastas-outlook", help="Lista as pastas do Outlook disponíveis")
    p_pastas.set_defaults(func=cmd_pastas_outlook)

    args = parser.parse_args()
    sys.exit(args.func(args))


if __name__ == "__main__":
    main()
