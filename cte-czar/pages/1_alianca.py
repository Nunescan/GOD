import streamlit as st
import tempfile
from pathlib import Path
import sys
import os
import shutil
import pandas as pd
from datetime import datetime

sys.path.append(str(Path(__file__).parent.parent))

from modules.alianca_engine.alianca_engine import AliancaEngine
from modules.alianca_engine.relatorio_engine import RelatorioAlianca
from modules.styles import aplicar_estilo

st.set_page_config(page_title="Aliança", layout="wide")
aplicar_estilo()

# Cabeçalho específico da Aliança
st.markdown("""
<div class="main-header alianca-header">
    <h1>⚓ Auditoria Aliança</h1>
    <p>Processamento completo de CTEs com relatórios detalhados</p>
</div>
""", unsafe_allow_html=True)

RAIZ_PROJETO = Path(__file__).parent.parent
PASTA_PROCESSADOS = RAIZ_PROJETO / "processados" / "alianca"
PASTA_PROCESSADOS.mkdir(parents=True, exist_ok=True)

if 'resultados_alianca' not in st.session_state:
    st.session_state['resultados_alianca'] = None
if 'relatorio_alianca' not in st.session_state:
    st.session_state['relatorio_alianca'] = None
if 'relatorio_completo_alianca' not in st.session_state:
    st.session_state['relatorio_completo_alianca'] = None

col_upload, col_info = st.columns([2, 1])

with col_upload:
    st.markdown("### 📤 Upload dos Arquivos")
    
    uploaded_files = st.file_uploader(
        "Selecione os arquivos PDF e XML",
        type=['pdf', 'xml'],
        accept_multiple_files=True,
        help="Faça upload de múltiplos arquivos PDF e XML"
    )
    
    if uploaded_files:
        st.success(f"✅ {len(uploaded_files)} arquivos selecionados")
        pdfs = [f for f in uploaded_files if f.name.endswith('.pdf')]
        xmls = [f for f in uploaded_files if f.name.endswith('.xml')]
        st.info(f"📁 {len(pdfs)} PDFs | {len(xmls)} XMLs")

with col_info:
    st.markdown("### ℹ️ Informações")
    st.markdown("""
    <div class="info-box">
    <strong>📋 Funcionalidades:</strong><br>
    • Processa PDFs e XMLs<br>
    • Renomeia automaticamente<br>
    • Extrai tags importantes<br>
    • Gera relatório completo<br>
    • Agrupa por container/lote
    </div>
    """, unsafe_allow_html=True)

if uploaded_files:
    st.divider()
    
    col1, col2 = st.columns(2)
    
    with col1:
        st.markdown("### 📁 Processar Arquivos")
        st.markdown("Renomeia e organiza os arquivos em pastas")
        
        nome_pasta = st.text_input("Nome da subpasta:", value="lote_atual", key="pasta_process_input")
        
        if st.button("🔍 PROCESSAR ARQUIVOS", use_container_width=True, type="primary"):
            with st.spinner("🔄 Processando arquivos..."):
                with tempfile.TemporaryDirectory() as temp_dir:
                    temp_path = Path(temp_dir)
                    for uploaded_file in uploaded_files:
                        file_path = temp_path / uploaded_file.name
                        with open(file_path, 'wb') as f:
                            f.write(uploaded_file.getbuffer())
                    
                    pasta_destino = PASTA_PROCESSADOS / nome_pasta
                    if pasta_destino.exists():
                        shutil.rmtree(pasta_destino)
                    
                    engine = AliancaEngine()
                    resultados = engine.processar_arquivos(temp_path, pasta_destino)
                    
                    st.session_state['resultados_alianca'] = resultados
                    st.success(f"✅ Processado com sucesso em: {pasta_destino}")
                    st.balloons()
    
    with col2:
        st.markdown("### 📊 Gerar Relatórios")
        st.markdown("Gere relatórios detalhados dos dados processados")
        
        subpastas = [p.name for p in PASTA_PROCESSADOS.iterdir() if p.is_dir() and p.name != "relatorios"]
        
        if subpastas:
            pasta_selecionada = st.selectbox("Selecione a pasta processada:", options=subpastas)
            
            col_btn1, col_btn2 = st.columns(2)
            
            with col_btn1:
                if st.button("📄 RELATÓRIO RESUMIDO", use_container_width=True):
                    with st.spinner("Gerando relatório resumido..."):
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
                            st.error("❌ Nenhum arquivo XML encontrado")
                        else:
                            with tempfile.TemporaryDirectory() as temp_dir:
                                temp_path = Path(temp_dir)
                                for xml_path in xmls_encontrados:
                                    shutil.copy2(xml_path, temp_path / xml_path.name)
                                
                                relatorio = RelatorioAlianca()
                                pasta_relatorio = PASTA_PROCESSADOS / "relatorios"
                                resultado = relatorio.gerar_relatorio(temp_path, pasta_relatorio)
                                
                                if resultado:
                                    st.session_state['relatorio_alianca'] = resultado
                                    st.success(f"✅ Relatório gerado com {resultado['total_ctes']} CTEs!")
                                    st.balloons()
            
            with col_btn2:
                if st.button("📑 RELATÓRIO COMPLETO", use_container_width=True, type="secondary"):
                    with st.spinner("Gerando relatório COMPLETO (sem filtros)..."):
                        pasta_completa = PASTA_PROCESSADOS / pasta_selecionada
                        
                        # Busca TODOS os XMLs em TODAS as pastas
                        xmls_encontrados = list(pasta_completa.rglob("*.xml"))
                        
                        if not xmls_encontrados:
                            st.error("❌ Nenhum arquivo XML encontrado")
                        else:
                            st.info(f"📁 Encontrados {len(xmls_encontrados)} XMLs (processando todos...)")
                            
                            with tempfile.TemporaryDirectory() as temp_dir:
                                temp_path = Path(temp_dir)
                                for xml_path in xmls_encontrados:
                                    shutil.copy2(xml_path, temp_path / xml_path.name)
                                
                                relatorio = RelatorioAlianca()
                                pasta_relatorio = PASTA_PROCESSADOS / "relatorios"
                                
                                # Gera relatório SEM filtros (todos os CTEs)
                                resultado = relatorio.gerar_relatorio(temp_path, pasta_relatorio)
                                
                                if resultado:
                                    st.session_state['relatorio_completo_alianca'] = resultado
                                    st.success(f"✅ Relatório COMPLETO gerado com {resultado['total_ctes']} CTEs!")
                                    st.balloons()
        else:
            st.info("⚠️ Nenhuma pasta processada encontrada. Processe os arquivos primeiro.")

# Resultados do processamento
if st.session_state['resultados_alianca']:
    st.divider()
    st.markdown("### 📊 Resultados do Processamento")
    
    resultados = st.session_state['resultados_alianca']
    stats = AliancaEngine().obter_estatisticas(resultados)
    
    cols = st.columns(4)
    with cols[0]:
        st.markdown(f"""
        <div class="metric-card">
            <h3>Total CTEs</h3>
            <p>{stats['total_geral']}</p>
        </div>
        """, unsafe_allow_html=True)
    with cols[1]:
        st.markdown(f"""
        <div class="metric-card">
            <h3>✅ Completos</h3>
            <p>{stats['total_completos']}</p>
        </div>
        """, unsafe_allow_html=True)
    with cols[2]:
        st.markdown(f"""
        <div class="metric-card">
            <h3>⚠️ Faltando PDF</h3>
            <p>{stats['total_faltando_pdf']}</p>
        </div>
        """, unsafe_allow_html=True)
    with cols[3]:
        st.markdown(f"""
        <div class="metric-card">
            <h3>⚠️ Faltando XML</h3>
            <p>{stats['total_faltando_xml']}</p>
        </div>
        """, unsafe_allow_html=True)

# Resultados do relatório resumido
if st.session_state['relatorio_alianca']:
    st.divider()
    st.markdown("### 📊 Relatório Resumido")
    
    resultado = st.session_state['relatorio_alianca']
    st.markdown(f'<div class="success-box">✅ {resultado["total_ctes"]} CTEs processados em {resultado["total_containers"]} containers</div>', unsafe_allow_html=True)
    
    with st.expander("📋 Preview do Relatório", expanded=False):
        df_preview = pd.DataFrame(resultado['dados'])
        colunas_preview = [c for c in ['Container', 'CTEs', 'Qtd CTEs', 'Origem', 'Destino', 'Ad Valorem (Total)'] if c in df_preview.columns]
        if colunas_preview:
            st.dataframe(df_preview[colunas_preview].head(10), use_container_width=True)
    
    if resultado.get('excel_path') and Path(resultado['excel_path']).exists():
        with open(resultado['excel_path'], 'rb') as f:
            st.download_button("📥 BAIXAR EXCEL RESUMIDO", data=f, file_name=Path(resultado['excel_path']).name, use_container_width=True)

# Resultados do relatório completo
if st.session_state['relatorio_completo_alianca']:
    st.divider()
    st.markdown("### 📊 Relatório Completo (Sem Filtros)")
    
    resultado = st.session_state['relatorio_completo_alianca']
    st.markdown(f'<div class="success-box">🎯 RELATÓRIO COMPLETO: {resultado["total_ctes"]} CTEs em {resultado["total_containers"]} containers</div>', unsafe_allow_html=True)
    
    with st.expander("📋 Preview do Relatório Completo", expanded=False):
        df_preview = pd.DataFrame(resultado['dados'])
        colunas_preview = [c for c in ['Container', 'CTEs', 'Qtd CTEs', 'Origem', 'Destino', 'Ad Valorem (Total)'] if c in df_preview.columns]
        if colunas_preview:
            st.dataframe(df_preview[colunas_preview].head(10), use_container_width=True)
    
    if resultado.get('excel_path') and Path(resultado['excel_path']).exists():
        with open(resultado['excel_path'], 'rb') as f:
            st.download_button("📥 BAIXAR EXCEL COMPLETO", data=f, file_name=Path(resultado['excel_path']).name, use_container_width=True)

# Botões de ação
col_acao1, col_acao2, col_acao3 = st.columns(3)

with col_acao1:
    if st.button("📂 ABRIR PASTA PROCESSADOS", use_container_width=True):
        os.startfile(str(PASTA_PROCESSADOS))

with col_acao2:
    if st.button("🔄 LIMPAR RESULTADOS", use_container_width=True):
        st.session_state['resultados_alianca'] = None
        st.session_state['relatorio_alianca'] = None
        st.session_state['relatorio_completo_alianca'] = None
        st.rerun()

with col_acao3:
    if st.button("🧹 LIMPAR PASTA ATUAL", use_container_width=True):
        if st.session_state.get('resultados_alianca'):
            pasta_atual = PASTA_PROCESSADOS / list(PASTA_PROCESSADOS.iterdir())[0].name if list(PASTA_PROCESSADOS.iterdir()) else None
            if pasta_atual and pasta_atual.exists():
                shutil.rmtree(pasta_atual)
                st.success("✅ Pasta atual limpa!")
                st.rerun()

st.divider()
st.markdown('<div class="footer">⚓ Sistema de Auditoria Aliança v2.0 | CTEs Processados</div>', unsafe_allow_html=True)