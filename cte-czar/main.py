import streamlit as st
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
from pathlib import Path
import json
from datetime import datetime
import sys
import os

# CONFIGURAÇÕES PRINCIPAIS DA PÁGINA
st.set_page_config(page_title="CZAR - Dashboard", layout="wide", initial_sidebar_state="expanded")

# CSS personalizado
st.markdown("""
    <style>
    .main-header {
        background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
        padding: 2rem;
        border-radius: 10px;
        color: white;
        text-align: center;
        margin-bottom: 2rem;
    }
    .metric-card {
        background-color: #f0f2f6;
        padding: 1.5rem;
        border-radius: 10px;
        text-align: center;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .upload-box {
        border: 2px dashed #667eea;
        padding: 2rem;
        border-radius: 10px;
        text-align: center;
        background-color: #f8f9fa;
    }
    </style>
""", unsafe_allow_html=True)

# Título
st.markdown('<div class="main-header"><h1>📊 CZAR DASHBOARD</h1><h3>Análise Consolidada de CTEs</h3></div>', unsafe_allow_html=True)

# Sidebar
with st.sidebar:
    st.markdown("<h2 style='text-align:center;'>👑 CZAR</h2>", unsafe_allow_html=True)
    st.markdown("---")
    
    st.markdown("### 📁 Upload da Planilha")
    uploaded_file = st.file_uploader(
        "Arraste ou selecione o arquivo Excel",
        type=['xlsx', 'xls'],
        help="Selecione o relatório gerado pelas páginas (Aliança, Mercosul, etc)"
    )
    
    st.markdown("---")
    st.markdown("### 🎯 Navegação Rápida")
    
    if st.button("📋 Ir para Aliança"):
        st.switch_page("pages/1_alianca.py")
    if st.button("📋 Ir para Mercosul"):
        st.switch_page("pages/2_mercosul.py")
    if st.button("📋 Ir para Norcoast"):
        st.switch_page("pages/3_norcoast.py")
    if st.button("📋 Ir para Login"):
        st.switch_page("pages/4_login.py")
    if st.button("📧 Ir para Coleta"):
        st.switch_page("pages/5_coleta.py")

# Área principal
if uploaded_file is not None:
    try:
        # Carrega o Excel
        df = pd.read_excel(uploaded_file)
        
        st.success(f"✅ Arquivo carregado: {uploaded_file.name}")
        
        # Métricas principais
        st.subheader("📊 Visão Geral")
        
        col1, col2, col3, col4 = st.columns(4)
        
        with col1:
            st.markdown('<div class="metric-card">', unsafe_allow_html=True)
            total_ctes = len(df) if 'CTE' in df.columns else len(df)
            st.metric("Total CTEs", total_ctes)
            st.markdown('</div>', unsafe_allow_html=True)
        
        with col2:
            st.markdown('<div class="metric-card">', unsafe_allow_html=True)
            if 'Valor Mercadoria (Total)' in df.columns:
                total_valor = df['Valor Mercadoria (Total)'].sum()
                st.metric("Valor Total Mercadoria", f"R$ {total_valor:,.2f}")
            else:
                st.metric("Valor Total", "N/D")
            st.markdown('</div>', unsafe_allow_html=True)
        
        with col3:
            st.markdown('<div class="metric-card">', unsafe_allow_html=True)
            if 'Frete Líquido (Total)' in df.columns:
                total_frete = df['Frete Líquido (Total)'].sum()
                st.metric("Total Frete", f"R$ {total_frete:,.2f}")
            else:
                st.metric("Total Frete", "N/D")
            st.markdown('</div>', unsafe_allow_html=True)
        
        with col4:
            st.markdown('<div class="metric-card">', unsafe_allow_html=True)
            if 'Container' in df.columns:
                containers_unicos = df['Container'].nunique()
                st.metric("Containers Únicos", containers_unicos)
            else:
                st.metric("Containers", "N/D")
            st.markdown('</div>', unsafe_allow_html=True)
        
        st.markdown("---")
        
        # Gráficos
        col_graf1, col_graf2 = st.columns(2)
        
        with col_graf1:
            st.subheader("📈 Top 10 Destinos")
            if 'Destino' in df.columns:
                destinos = df['Destino'].value_counts().head(10)
                fig = px.bar(
                    x=destinos.values,
                    y=destinos.index,
                    orientation='h',
                    title="CTEs por Destino",
                    labels={'x': 'Quantidade', 'y': 'Destino'},
                    color=destinos.values,
                    color_continuous_scale='viridis'
                )
                fig.update_layout(height=400)
                st.plotly_chart(fig, use_container_width=True)
        
        with col_graf2:
            st.subheader("💰 Top 10 Valores de Mercadoria")
            if 'Valor Mercadoria (Total)' in df.columns and 'CTE' in df.columns:
                top_valores = df.nlargest(10, 'Valor Mercadoria (Total)')[['CTE', 'Valor Mercadoria (Total)']]
                fig = px.bar(
                    x=top_valores['Valor Mercadoria (Total)'],
                    y=top_valores['CTE'].astype(str),
                    orientation='h',
                    title="Maiores Valores por CTE",
                    labels={'x': 'Valor (R$)', 'y': 'CTE'},
                    color=top_valores['Valor Mercadoria (Total)'],
                    color_continuous_scale='reds'
                )
                fig.update_layout(height=400)
                st.plotly_chart(fig, use_container_width=True)
        
        # Segunda linha de gráficos
        col_graf3, col_graf4 = st.columns(2)
        
        with col_graf3:
            st.subheader("📦 Distribuição por Container")
            if 'Container' in df.columns and 'Qtd CTEs' in df.columns:
                top_containers = df.nlargest(10, 'Qtd CTEs')[['Container', 'Qtd CTEs']]
                fig = px.pie(
                    top_containers,
                    values='Qtd CTEs',
                    names='Container',
                    title="Top 10 Containers por Quantidade de CTEs",
                    hole=0.4
                )
                fig.update_layout(height=400)
                st.plotly_chart(fig, use_container_width=True)
        
        with col_graf4:
            st.subheader("⏰ CTEs por Data")
            if 'Data Emissão' in df.columns:
                df['Data'] = pd.to_datetime(df['Data Emissão'], errors='coerce')
                ctes_por_dia = df.groupby(df['Data'].dt.date).size().reset_index(name='Quantidade')
                fig = px.line(
                    ctes_por_dia,
                    x='Data',
                    y='Quantidade',
                    title="CTEs por Dia",
                    markers=True
                )
                fig.update_layout(height=400)
                st.plotly_chart(fig, use_container_width=True)
        
        # Tabela de dados
        st.markdown("---")
        st.subheader("📋 Dados Detalhados")
        
        colunas_mostrar = ['CTE', 'Container', 'Origem', 'Destino', 
                          'Valor Mercadoria (Total)', 'Frete Líquido (Total)']
        
        colunas_existentes = [c for c in colunas_mostrar if c in df.columns]
        
        if colunas_existentes:
            st.dataframe(
                df[colunas_existentes].head(100),
                use_container_width=True,
                hide_index=True
            )
            
            csv = df[colunas_existentes].to_csv(index=False)
            st.download_button(
                label="📥 Download CSV",
                data=csv,
                file_name=f"dados_filtrados_{datetime.now().strftime('%Y%m%d_%H%M')}.csv",
                mime="text/csv"
            )
        
    except Exception as e:
        st.error(f"❌ Erro ao processar o arquivo: {str(e)}")
        st.exception(e)

else:
    st.markdown('<div class="upload-box">', unsafe_allow_html=True)
    st.markdown("""
    ### 👋 Bem-vindo ao CZAR Dashboard!
    
    **Para começar:**
    1. Faça o upload de um relatório Excel gerado pelas páginas
    2. O dashboard irá gerar automaticamente:
        - 📊 Métricas consolidadas
        - 📈 Gráficos interativos
        - 📋 Tabelas detalhadas
    
    **Fontes de dados:**
    - Aliança
    - Mercosul  
    - Norcoast
    - Login
    """)
    st.markdown('</div>', unsafe_allow_html=True)
    
    st.markdown("---")
    st.subheader("📊 Exemplo de Visualização")
    
    col1, col2 = st.columns(2)
    
    with col1:
        dados_exemplo = pd.DataFrame({
            'Destino': ['São Paulo', 'Rio de Janeiro', 'Belo Horizonte', 'Curitiba', 'Porto Alegre'],
            'CTEs': [45, 38, 27, 19, 12]
        })
        fig = px.bar(dados_exemplo, x='Destino', y='CTEs', title="CTEs por Destino (Exemplo)")
        st.plotly_chart(fig, use_container_width=True)
    
    with col2:
        dados_pizza = pd.DataFrame({
            'Armador': ['Aliança', 'Mercosul', 'Norcoast', 'Login'],
            'CTEs': [120, 95, 78, 42]
        })
        fig = px.pie(dados_pizza, values='CTEs', names='Armador', title="CTEs por Armador (Exemplo)")
        st.plotly_chart(fig, use_container_width=True)

st.markdown("---")
st.markdown("<center><small>CZAR System v3.0 - Dashboard Analítico</small></center>", unsafe_allow_html=True)