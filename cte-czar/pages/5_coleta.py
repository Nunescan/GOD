import streamlit as st
import json
from pathlib import Path
from datetime import datetime
from modules.scraping import OutlookScanner, escanear_pastas_outlook
import sys
import os

sys.path.append(str(Path(__file__).parent.parent))

from modules.scraping import escanear_pastas_outlook
from modules.download_anexos import DownloadAnexos

st.set_page_config(page_title="Coleta de CTEs", layout="wide")

st.title("📧 Scraping Czar")
st.subheader("Vincule as pastas do Outlook aos Armadores")

PASTA_DOWNLOADS = Path(__file__).parent.parent / "downloads" / "CTEs"

if 'pastas_outlook' not in st.session_state:
    st.session_state['pastas_outlook'] = []

if 'vinculos_salvos' not in st.session_state:
    arquivo_vinculos = Path(__file__).parent.parent / "config" / "vinculos.json"
    if arquivo_vinculos.exists():
        with open(arquivo_vinculos, 'r', encoding='utf-8') as f:
            st.session_state['vinculos_salvos'] = json.load(f)
    else:
        st.session_state['vinculos_salvos'] = {}

ARMADORES = ["Aliança", "Mercosul", "Norcoast", "Login"]

col1, col2, col3 = st.columns([1, 2, 1])
with col2:
    if st.button("📧 1. Escanear Pastas do Outlook", use_container_width=True, type="primary"):
        with st.spinner("Escaneando Outlook..."):
            pastas = escanear_pastas_outlook()
            if pastas:
                st.session_state['pastas_outlook'] = sorted(pastas)
                st.success(f"✅ {len(pastas)} pastas encontradas!")
            else:
                st.session_state['pastas_outlook'] = [
                    "FATURAMENTO", "CTES PENDENTES", "NOTAS FISCAIS", 
                    "EMBARQUES", "CONHECIMENTOS", "ALIANÇA", "MERCOSUL",
                    "NORCOAST", "LOGIN", "COMPRAS", "FINANCEIRO"
                ]
                st.warning("⚠️ Usando dados simulados")

st.divider()

col_esquerda, col_direita = st.columns(2)

with col_esquerda:
    st.subheader("📋 Armadores")
    for armador in ARMADORES:
        with st.container():
            st.markdown(f"### {armador}")
            pasta_vinculada = st.session_state['vinculos_salvos'].get(armador, "Não vinculado")
            if pasta_vinculada != "Não vinculado":
                st.success(f"📁 Pasta: {pasta_vinculada}")
            else:
                st.info("⭕ Nenhuma pasta vinculada")
            st.divider()

with col_direita:
    st.subheader("⚙️ Vincular Pastas")
    
    if not st.session_state['pastas_outlook']:
        st.info("👆 Clique em 'Escanear Pastas do Outlook' para começar")
    else:
        st.write(f"**{len(st.session_state['pastas_outlook'])} pastas disponíveis**")
        
        filtro = st.text_input("🔍 Filtrar pastas:", placeholder="Digite para filtrar...")
        pastas_filtradas = [p for p in st.session_state['pastas_outlook'] 
                           if filtro.lower() in p.lower()] if filtro else st.session_state['pastas_outlook']
        
        novos_vinculos = {}
        
        for armador in ARMADORES:
            with st.container():
                st.markdown(f"**{armador}**")
                valor_atual = st.session_state['vinculos_salvos'].get(armador, "")
                opcoes = [""] + pastas_filtradas
                indice_atual = 0
                if valor_atual in opcoes:
                    indice_atual = opcoes.index(valor_atual)
                
                pasta_selecionada = st.selectbox(
                    f"Selecione a pasta para {armador}:",
                    options=opcoes,
                    index=indice_atual,
                    key=f"select_{armador}",
                    label_visibility="collapsed"
                )
                
                if pasta_selecionada:
                    novos_vinculos[armador] = pasta_selecionada
                st.divider()
        
        col_btn1, col_btn2 = st.columns(2)
        
        with col_btn1:
            if st.button("💾 Salvar Vínculos", use_container_width=True):
                st.session_state['vinculos_salvos'] = novos_vinculos
                Path("config").mkdir(exist_ok=True)
                with open(Path(__file__).parent.parent / "config" / "vinculos.json", 'w', encoding='utf-8') as f:
                    json.dump(novos_vinculos, f, indent=4, ensure_ascii=False)
                st.success("✅ Vínculos salvos!")
                st.rerun()
        
        with col_btn2:
            if st.button("🔄 Reset", use_container_width=True):
                st.session_state['vinculos_salvos'] = {}
                st.rerun()

if st.session_state['vinculos_salvos']:
    st.divider()
    st.subheader("🚀 PROCESSAR TUDO")
    
    st.info(f"📊 **{len(st.session_state['vinculos_salvos'])} pastas serão processadas:** " + 
            ", ".join([f"{a} ({p})" for a, p in st.session_state['vinculos_salvos'].items()]))
    
    col_proc1, col_proc2, col_proc3, col_proc4 = st.columns([1, 2, 1, 1])
    
    with col_proc1:
        if st.button("🧹 LIMPAR PASTAS", use_container_width=True):
            with st.spinner("Limpando pastas..."):
                downloader = DownloadAnexos(pasta_base=PASTA_DOWNLOADS)
                for armador in ARMADORES:
                    downloader.limpar_pasta_armador(armador)
                st.success("✅ Pastas limpas!")
                if 'resultado_final' in st.session_state:
                    del st.session_state['resultado_final']
                st.rerun()
    
    with col_proc2:
        dias = st.number_input("Período (dias):", min_value=1, max_value=9999, value=9999)
    
    with col_proc3:
        if st.button("🔥 INICIAR", use_container_width=True, type="primary"):
            with st.spinner("Processando todas as pastas vinculadas..."):
                progress_bar = st.progress(0)
                status_text = st.empty()
                
                scanner = OutlookScanner()
                downloader = DownloadAnexos(pasta_base=PASTA_DOWNLOADS)
                
                if not scanner.conectar_outlook():
                    st.error("❌ Erro ao conectar ao Outlook")
                else:
                    resultados = {}
                    total_pastas = len(st.session_state['vinculos_salvos'])
                    
                    for i, (armador, pasta) in enumerate(st.session_state['vinculos_salvos'].items()):
                        status_text.write(f"📁 **Processando {i+1}/{total_pastas}: {armador}** - Pasta: {pasta}")
                        
                        arquivos_baixados = downloader.baixar_todos_anexos_da_pasta(
                            pasta_nome=pasta,
                            armador=armador,
                            scanner=scanner,
                            dias=dias
                        )
                        
                        resultados[armador] = {
                            'pasta': pasta,
                            'total_arquivos': len(arquivos_baixados),
                            'arquivos': arquivos_baixados
                        }
                        
                        progress_bar.progress((i + 1) / total_pastas)
                    
                    status_text.empty()
                    st.session_state['resultado_final'] = resultados
                    
                    total_geral = sum(r['total_arquivos'] for r in resultados.values())
                    st.balloons()
                    st.success(f"✅ PROCESSAMENTO CONCLUÍDO! Total: {total_geral} arquivos")
    
    with col_proc4:
        if st.button("📂 ABRIR", use_container_width=True):
            PASTA_DOWNLOADS.mkdir(parents=True, exist_ok=True)
            os.startfile(str(PASTA_DOWNLOADS))

if 'resultado_final' in st.session_state:
    st.divider()
    st.subheader("📊 RESULTADOS DETALHADOS")
    
    resultados = st.session_state['resultado_final']
    total_arquivos = sum(r['total_arquivos'] for r in resultados.values())
    
    col1, col2, col3, col4 = st.columns(4)
    with col1:
        st.metric("Total Arquivos", total_arquivos)
    with col2:
        st.metric("Armadores", len(resultados))
    with col3:
        st.metric("Média", round(total_arquivos/len(resultados) if resultados else 0, 1))
    with col4:
        st.metric("Pastas", len(st.session_state['vinculos_salvos']))
    
    st.divider()
    
    for armador, info in resultados.items():
        with st.expander(f"📁 **{armador}** - {info['total_arquivos']} arquivos (Pasta: {info['pasta']})"):
            if info['arquivos']:
                pdfs = [a for a in info['arquivos'] if a['tipo'] == 'pdf']
                xmls = [a for a in info['arquivos'] if a['tipo'] == 'xml']
                
                col_t1, col_t2 = st.columns(2)
                with col_t1:
                    st.metric("PDFs", len(pdfs))
                with col_t2:
                    st.metric("XMLs", len(xmls))
                
                st.write("---")
                for arquivo in info['arquivos'][:30]:
                    fonte = "📦 ZIP" if arquivo.get('fonte') == 'zip' else "📧 EML" if arquivo.get('fonte') == 'eml' else "📎 Direto"
                    st.write(f"- {fonte} {arquivo['nome']} ({arquivo['tipo']})")
                
                if info['total_arquivos'] > 30:
                    st.write(f"... e mais {info['total_arquivos'] - 30} arquivos")
            else:
                st.write("Nenhum arquivo encontrado")

st.divider()
st.info(f"📁 **Pasta de Downloads:** {PASTA_DOWNLOADS}")

if st.button("🧹 Limpar Resultados da Tela"):
    if 'resultado_final' in st.session_state:
        del st.session_state['resultado_final']
    st.rerun()