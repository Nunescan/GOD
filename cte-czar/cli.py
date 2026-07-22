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


def cmd_buscar_anexo(args):
    """Acha o e-mail mais recente de uma pasta (com filtro opcional de
    assunto) que tenha uma planilha em anexo, e salva esse anexo num caminho
    escolhido. Usado pela verificação diária de cabotagem."""
    from modules.scraping import OutlookScanner, encontrar_pasta

    print("Conectando ao Outlook...")
    scanner = OutlookScanner()
    if not scanner.conectar_outlook():
        print("ERRO: não foi possível conectar ao Outlook. Verifique se ele está instalado e aberto.")
        return 1

    pasta = encontrar_pasta(args.pasta, scanner)
    if not pasta:
        print(f"Pasta não encontrada: {args.pasta}")
        return 1

    itens = pasta.Items
    try:
        itens.Sort("[ReceivedTime]", True)
    except Exception as e:
        print(f"Aviso: não foi possível ordenar por data: {e}")

    total = itens.Count
    print(f"{total} item(ns) na pasta '{args.pasta}'")

    palavra = (args.assunto or "").strip().lower()
    encontrado = None
    for i in range(1, total + 1):
        try:
            item = itens.Item(i)
            if not (hasattr(item, 'Class') and item.Class == 43):
                continue
            if palavra and palavra not in str(item.Subject or "").lower():
                continue
            if not (hasattr(item, 'Attachments') and item.Attachments.Count > 0):
                continue

            for j in range(1, item.Attachments.Count + 1):
                anexo = item.Attachments.Item(j)
                nome = anexo.FileName
                if Path(nome).suffix.lower() in ('.xlsx', '.xls'):
                    encontrado = (item, anexo, nome)
                    break

            if encontrado:
                break
        except Exception:
            continue

    if not encontrado:
        filtro = f" (assunto contendo \"{args.assunto}\")" if args.assunto else ""
        print(f"Nenhum e-mail com planilha em anexo encontrado{filtro}.")
        return 1

    item, anexo, nome_original = encontrado
    destino = Path(args.destino)
    destino.parent.mkdir(parents=True, exist_ok=True)
    anexo.SaveAsFile(str(destino))

    assunto = str(item.Subject or "")
    recebido = ""
    try:
        recebido = item.ReceivedTime.strftime("%Y-%m-%d %H:%M")
    except Exception:
        pass

    print(f"Anexo salvo: {destino}")
    _print_result({
        "tipo": "buscarAnexo",
        "assunto": assunto,
        "recebidoEm": recebido,
        "arquivoOriginal": nome_original,
        "destino": str(destino),
    })
    return 0


def cmd_buscar_emails(args):
    """Busca e-mails numa pasta cujo assunto/corpo contenha alguma das
    palavras-chave (separadas por virgula), devolvendo assunto/remetente/data."""
    from modules.scraping import OutlookScanner, encontrar_pasta

    print("Conectando ao Outlook...")
    scanner = OutlookScanner()
    if not scanner.conectar_outlook():
        print("ERRO: não foi possível conectar ao Outlook. Verifique se ele está instalado e aberto.")
        return 1

    pasta = encontrar_pasta(args.pasta, scanner)
    if not pasta:
        print(f"Pasta não encontrada: {args.pasta}")
        return 1

    itens = pasta.Items
    try:
        itens.Sort("[ReceivedTime]", True)
    except Exception as e:
        print(f"Aviso: não foi possível ordenar por data: {e}")

    total = itens.Count
    print(f"{total} item(ns) na pasta '{args.pasta}'")

    palavras = [p.strip().lower() for p in (args.palavras or "").split(",") if p.strip()]
    limite = args.limite or 50

    resultados = []
    for i in range(1, total + 1):
        if len(resultados) >= limite:
            break
        try:
            item = itens.Item(i)
            if not (hasattr(item, 'Class') and item.Class == 43):
                continue

            assunto = str(item.Subject or "")
            corpo = ""
            try:
                corpo = str(item.Body or "")
            except Exception:
                pass

            texto = f"{assunto} {corpo}".lower()
            if palavras and not any(p in texto for p in palavras):
                continue

            recebido = ""
            try:
                recebido = item.ReceivedTime.strftime("%Y-%m-%d %H:%M")
            except Exception:
                pass

            resultados.append({
                "assunto": assunto,
                "remetente": str(getattr(item, 'SenderName', '') or ''),
                "recebidoEm": recebido,
                "temAnexo": bool(hasattr(item, 'Attachments') and item.Attachments.Count > 0),
            })
        except Exception:
            continue

    print(f"{len(resultados)} e-mail(s) encontrado(s)")
    _print_result({"tipo": "buscarEmails", "emails": resultados})
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

    p_anexo = sub.add_parser("buscar-anexo", help="Salva o anexo de planilha do e-mail mais recente de uma pasta")
    p_anexo.add_argument("--pasta", required=True)
    p_anexo.add_argument("--assunto", help="Filtro opcional: só considera e-mails com essa palavra no assunto")
    p_anexo.add_argument("--destino", required=True)
    p_anexo.set_defaults(func=cmd_buscar_anexo)

    p_emails = sub.add_parser("buscar-emails", help="Busca e-mails numa pasta por palavra-chave")
    p_emails.add_argument("--pasta", required=True)
    p_emails.add_argument("--palavras", help="Palavras-chave separadas por vírgula (assunto ou corpo)")
    p_emails.add_argument("--limite", type=int, default=50)
    p_emails.set_defaults(func=cmd_buscar_emails)

    args = parser.parse_args()
    sys.exit(args.func(args))


if __name__ == "__main__":
    main()
