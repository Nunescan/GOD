import streamlit as st
import tempfile
from pathlib import Path
import sys
import os
import shutil
import pandas as pd
from datetime import datetime

sys.path.append(str(Path(__file__).parent.parent))

from modules.norcoast_engine.norcoast_engine import NorcoastEngine
from modules.norcoast_engine.relatorio_engine_nc import RelatorioNorcoast

st.set_page_config(page_title="Norcoast", layout="wide")

st.markdown("""
    <style>
    .main-header {
        background: linear-gradient(90deg, #006994 0%, #0099cc 100%);
        padding: 1.5rem;
        border-radius: 10px;
        color: white;
        text-align: center;
        margin-bottom: 2rem;
    }
    .metric-card {
        background-color: #f0f2f6;
        padding: 1rem;
        border-radius: 10px;
        text-align: center;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    </style>
""", unsafe_allow_html=True)

RAIZ_PROJETO = Path(__file__).parent.parent
PASTA_PROCESSADOS = RAIZ_PROJETO / "processados" / "norcoast"
PASTA_PROCESSADOS.mkdir(parents=True, exist_ok=True)

st.markdown('<div class="main-header"><h1>⚓ Auditoria Norcoast</h1><h3>Processamento de CTEs</h3></div>', unsafe_allow_html=True)

if 'resultados_norcoast' not in st.session_state:
    st.session_state['resultados_norcoast'] = None
if 'relatorio_norcoast' not in st.session_state:
    st.session_state['relatorio_norcoast'] = None

col_upload, col_info = st.columns([2, 1])

with col_upload:
    st.subheader("📤 Upload dos Arquivos")
    
    uploaded_files = st.file_uploader(
        "Selecione os arquivos PDF e XML",
        type=['pdf', 'xml'],
        accept_multiple_files=True
    )
    
    if uploaded_files:
        st.success(f"✅ {len(uploaded_files)} arquivos selecionados")
        pdfs = [f for f in uploaded_files if f.name.endswith('.pdf')]
        xmls = [f for f in uploaded_files if f.name.endswith('.xml')]
        st.info(f"📁 {len(pdfs)} PDFs | {len(xmls)} XMLs")

with col_info:
    st.subheader("ℹ️ Informações")
    st.markdown("""
    **Fluxo:**
    1. Upload dos arquivos
    2. Processar → organiza em pastas
    3. Relatório → gera Excel
    """)

if uploaded_files:
    st.divider()
    
    col1, col2 = st.columns(2)
    
    with col1:
        st.markdown("### 📁 1. Processar Arquivos")
        nome_pasta = st.text_input("Nome da subpasta:", value="lote_atual", key="pasta_process_input")
        
        if st.button("🔍 PROCESSAR ARQUIVOS", use_container_width=True, type="primary"):
            with st.spinner("Processando..."):
                with tempfile.TemporaryDirectory() as temp_dir:
                    temp_path = Path(temp_dir)
                    for uploaded_file in uploaded_files:
                        file_path = temp_path / uploaded_file.name
                        with open(file_path, 'wb') as f:
                            f.write(uploaded_file.getbuffer())
                    
                    pasta_destino = PASTA_PROCESSADOS / nome_pasta
                    if pasta_destino.exists():
                        shutil.rmtree(pasta_destino)
                    
                    engine = NorcoastEngine()
                    resultados = engine.processar_arquivos(temp_path, pasta_destino)
                    
                    st.session_state['resultados_norcoast'] = resultados
                    st.success(f"✅ Processado em: {pasta_destino}")
                    st.balloons()
    
    with col2:
        st.markdown("### 📊 2. Gerar Relatório")
        
        subpastas = [p.name for p in PASTA_PROCESSADOS.iterdir() if p.is_dir() and p.name != "relatorios"]
        
        if subpastas:
            pasta_selecionada = st.selectbox("Selecione a pasta:", options=subpastas)
            
            if st.button("📥 GERAR RELATÓRIO", use_container_width=True, type="primary"):
                with st.spinner("Gerando relatório..."):
                    pasta_completa = PASTA_PROCESSADOS / pasta_selecionada
                    
                    xmls_encontrados = []
                    pastas_xml = [
                        pasta_completa / "completos" / "xmls",
                        pasta_completa / "faltando" / "faltando_pdf",
                        pasta_completa
                    ]
                    
                    for pasta_xml in pastas_xml:
                        if pasta_xml.exists():
                            xmls_encontrados.extend(list(pasta_xml.glob("*.xml")))
                    
                    if not xmls_encontrados:
                        st.error("❌ Nenhum XML encontrado")
                    else:
                        st.success(f"📁 {len(xmls_encontrados)} XMLs")
                        
                        with tempfile.TemporaryDirectory() as temp_dir:
                            temp_path = Path(temp_dir)
                            for xml_path in xmls_encontrados:
                                shutil.copy2(xml_path, temp_path / xml_path.name)
                            
                            relatorio = RelatorioNorcoast()
                            pasta_relatorio = PASTA_PROCESSADOS / "relatorios"
                            resultado = relatorio.gerar_relatorio(temp_path, pasta_relatorio)
                            
                            if resultado:
                                st.session_state['relatorio_norcoast'] = resultado
                                st.success(f"✅ Relatório com {resultado['total_ctes']} CTEs!")
                                st.balloons()
        else:
            st.info("Processe os arquivos primeiro")

if st.session_state['resultados_norcoast']:
    st.divider()
    st.subheader("📊 Resultados")
    
    resultados = st.session_state['resultados_norcoast']
    stats = NorcoastEngine().obter_estatisticas(resultados)
    
    col1, col2, col3, col4 = st.columns(4)
    col1.metric("Total CTEs", stats['total_geral'])
    col2.metric("✅ Completos", stats['total_completos'])
    col3.metric("⚠️ Faltando PDF", stats['total_faltando_pdf'])
    col4.metric("⚠️ Faltando XML", stats['total_faltando_xml'])

if st.session_state['relatorio_norcoast']:
    st.divider()
    resultado = st.session_state['relatorio_norcoast']
    st.success(f"✅ {resultado['total_ctes']} CTEs em {resultado['total_containers']} containers")
    
    if resultado.get('excel_path') and Path(resultado['excel_path']).exists():
        with open(resultado['excel_path'], 'rb') as f:
            st.download_button("📥 BAIXAR EXCEL", data=f, file_name=Path(resultado['excel_path']).name)

if st.button("📂 ABRIR PASTA"):
    os.startfile(str(PASTA_PROCESSADOS))

st.caption("⚓ Auditoria Norcoast v1.0")