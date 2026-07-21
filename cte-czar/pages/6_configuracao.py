import streamlit as st
import json
from pathlib import Path

st.set_page_config(page_title="Configurações", layout="wide")

st.title("⚙️ Configurações do Sistema")

tab1, tab2, tab3 = st.tabs(["🔧 Gerais", "👥 Armadores", "📊 Dados"])

with tab1:
    st.subheader("Configurações Gerais")
    
    col1, col2 = st.columns(2)
    
    with col1:
        st.number_input("Timeout de conexão (segundos):", min_value=10, max_value=300, value=60)
        st.selectbox("Modo de operação:", ["Produção", "Teste", "Desenvolvimento"])
    
    with col2:
        st.text_input("Pasta padrão para downloads:", value=str(Path.home() / "Downloads" / "CTEs"))
        st.checkbox("Iniciar com Windows", value=False)

with tab2:
    st.subheader("Gerenciar Armadores")
    
    armadores = ["Aliança", "Mercosul", "Norcoast", "Login"]
    
    for armador in armadores:
        col1, col2, col3 = st.columns([2, 3, 1])
        with col1:
            st.write(f"**{armador}**")
        with col2:
            st.text_input("Email do contato:", key=f"email_{armador}", placeholder="email@exemplo.com")
        with col3:
            st.button("🗑️", key=f"del_{armador}")

with tab3:
    st.subheader("Gerenciar Dados")
    
    col1, col2 = st.columns(2)
    
    with col1:
        st.warning("⚠️ Exportar dados")
        if st.button("📤 Exportar configurações"):
            st.success("Configurações exportadas!")
        
        if st.button("📤 Exportar vínculos"):
            st.success("Vínculos exportados!")
    
    with col2:
        st.error("⚠️ Importar/Resetar")
        uploaded_file = st.file_uploader("Importar configurações", type=['json'])
        
        if st.button("🔄 Resetar para padrão"):
            st.warning("Isso resetará todas as configurações!")

st.divider()
st.caption("CZAR System v3.0")