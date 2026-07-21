import streamlit as st
import tempfile
from pathlib import Path
import sys
import os
import shutil
import pandas as pd

sys.path.append(str(Path(__file__).parent.parent))

from modules.login_engine.login_engine import LoginEngine
from modules.login_engine.relatorio_engine_login import RelatorioLogin

st.set_page_config(page_title="Login", layout="wide")

st.markdown("""
    <style>
    .main-header {
        background: linear-gradient(90deg, #2E8B57 0%, #3CB371 100%);
        padding: 1.5rem;
        border-radius: 10px;
        color: white;
        text-align: center;
        margin-bottom: 2rem;
    }
    .teach-box {
        background-color: #fff3cd;
        padding: 1rem;
        border-radius: 10px;
        border-left: 4px solid #ffc107;
        margin: 1rem 0;
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
PASTA_PROCESSADOS = RAIZ_PROJETO / "processados" / "login"
PASTA_PROCESSADOS.mkdir(parents=True, exist_ok=True)

st.markdown('<div class="main-header"><h1>⚓ Auditoria Login</h1><h3>Processamento de PDFs</h3></div>', unsafe_allow_html=True)

if 'resultados_login' not in st.session_state:
    st.session_state['resultados_login'] = None
if 'relatorio_login' not in st.session_state:
    st.session_state['relatorio_login'] = None
if 'modelo_ensinado' not in st.session_state:
    st.session_state['modelo_ensinado'] = False

with st.expander("🎓 PASSO 1: Ensinar o padrão do CTE", expanded=not st.session_state['modelo_ensinado']):
    st.markdown('<div class="teach-box">', unsafe_allow_html=True)
    st.markdown("""
    **Como ensinar:**
    1. Faça um print do PDF
    2. Desenhe um **retângulo VERMELHO** em volta do número do CTE
    3. Faça upload da imagem
    4. Clique em "Ensinar Padrão"
    """)
    st.markdown('</div>', unsafe_allow_html=True)
    
    exemplo_file = st.file_uploader("Upload da imagem com retângulo vermelho:", type=['png', 'jpg', 'jpeg'])
    
    if exemplo_file:
        from PIL import Image
        imagem = Image.open(exemplo_file)
        st.image(imagem, caption="Sua imagem", use_container_width=True)
        
        if st.button("🎓 Ensinar Padrão", use_container_width=True):
            with st.spinner("Detectando retângulo vermelho..."):
                engine = LoginEngine()
                if engine.ensinar_com_exemplo(exemplo_file):
                    st.session_state['modelo_ensinado'] = True
                    st.success("✅ Padrão aprendido!")
                    
                    if os.path.exists("regiao_do_numero.png"):
                        st.image("regiao_do_numero.png", caption="Região do número")
                    st.balloons()
                else:
                    st.error("❌ Retângulo vermelho não detectado")

if st.session_state['modelo_ensinado']:
    st.divider()
    st.subheader("📤 PASSO 2: Upload dos PDFs")
    
    uploaded_files = st.file_uploader(
        "Selecione os arquivos PDF",
        type=['pdf'],
        accept_multiple_files=True
    )
    
    if uploaded_files:
        st.success(f"✅ {len(uploaded_files)} arquivos selecionados")
        
        col1, col2 = st.columns(2)
        
        with col1:
            nome_pasta = st.text_input("Nome da pasta:", value="lote_atual")
            
            if st.button("🚀 PROCESSAR PDFs", use_container_width=True, type="primary"):
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
                        
                        engine = LoginEngine()
                        resultados = engine.processar_arquivos(temp_path, pasta_destino)
                        
                        st.session_state['resultados_login'] = resultados
                        st.success(f"✅ Processado em: {pasta_destino}")
                        st.balloons()
        
        with col2:
            if st.button("📥 GERAR RELATÓRIO", use_container_width=True):
                relatorio = RelatorioLogin()
                pasta_relatorio = PASTA_PROCESSADOS / "relatorios"
                resultado = relatorio.gerar_relatorio(Path(st.session_state['resultados_login']['arquivos_originais'][0]['caminho']).parent if st.session_state.get('resultados_login') else None, pasta_relatorio)
                
                if resultado:
                    st.session_state['relatorio_login'] = resultado
                    st.success(f"✅ Relatório com {resultado['total_arquivos']} arquivos!")

if st.session_state['resultados_login']:
    st.divider()
    st.subheader("📊 Resultados")
    
    resultados = st.session_state['resultados_login']
    stats = LoginEngine().obter_estatisticas(resultados)
    
    col1, col2, col3, col4 = st.columns(4)
    col1.metric("Arquivos Originais", stats['total_originais'])
    col2.metric("Páginas Extraídas", stats['total_paginas'])
    col3.metric("✅ Com CTE", stats['com_cte'])
    col4.metric("❌ Sem CTE", stats['sem_cte'])
    
    with st.expander("📋 Ver páginas extraídas"):
        for item in resultados['paginas_extraidas'][:30]:
            if item['cte']:
                st.write(f"✅ {item['arquivo_gerado']}")
            else:
                st.write(f"❌ {item['arquivo_gerado']}")

if st.session_state['relatorio_login']:
    resultado = st.session_state['relatorio_login']
    if resultado.get('excel_path') and Path(resultado['excel_path']).exists():
        with open(resultado['excel_path'], 'rb') as f:
            st.download_button("📥 BAIXAR EXCEL", data=f, file_name=Path(resultado['excel_path']).name)

if st.button("📂 ABRIR PASTA"):
    os.startfile(str(PASTA_PROCESSADOS))

st.caption("⚓ Auditoria Login v1.0")