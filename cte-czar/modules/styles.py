# modules/styles.py
import streamlit as st

def aplicar_estilo():
    st.markdown("""
    <style>
    /* Cabeçalhos */
    .main-header {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        padding: 2rem;
        border-radius: 15px;
        color: white;
        text-align: center;
        margin-bottom: 2rem;
        box-shadow: 0 10px 30px rgba(0,0,0,0.2);
    }
    
    .alianca-header {
        background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
    }
    
    .mercosul-header {
        background: linear-gradient(135deg, #8B0000 0%, #B22222 100%);
    }
    
    .norcoast-header {
        background: linear-gradient(135deg, #006994 0%, #0099cc 100%);
    }
    
    .login-header {
        background: linear-gradient(135deg, #2E8B57 0%, #3CB371 100%);
    }
    
    .coleta-header {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    }
    
    /* Cards de métricas */
    .metric-card {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        padding: 1.2rem;
        border-radius: 15px;
        text-align: center;
        color: white;
        box-shadow: 0 5px 15px rgba(0,0,0,0.1);
        transition: transform 0.3s;
    }
    
    .metric-card:hover {
        transform: translateY(-5px);
    }
    
    .metric-card h3 {
        margin: 0;
        font-size: 0.9rem;
        opacity: 0.9;
    }
    
    .metric-card p {
        margin: 0;
        font-size: 1.8rem;
        font-weight: bold;
    }
    
    /* Botões */
    .stButton > button {
        border-radius: 10px;
        font-weight: bold;
        transition: all 0.3s;
    }
    
    .stButton > button:hover {
        transform: scale(1.02);
        box-shadow: 0 5px 15px rgba(0,0,0,0.2);
    }
    
    /* Success Box */
    .success-box {
        background: linear-gradient(135deg, #d4edda 0%, #c3e6cb 100%);
        color: #155724;
        padding: 1rem;
        border-radius: 10px;
        border-left: 4px solid #28a745;
    }
    
    /* Warning Box */
    .warning-box {
        background: linear-gradient(135deg, #fff3cd 0%, #ffeeba 100%);
        color: #856404;
        padding: 1rem;
        border-radius: 10px;
        border-left: 4px solid #ffc107;
    }
    
    /* Info Box */
    .info-box {
        background: linear-gradient(135deg, #d1ecf1 0%, #bee5eb 100%);
        color: #0c5460;
        padding: 1rem;
        border-radius: 10px;
        border-left: 4px solid #17a2b8;
    }
    
    /* Expander */
    .streamlit-expanderHeader {
        background-color: #f0f2f6;
        border-radius: 10px;
        font-weight: bold;
    }
    
    /* Tabs */
    .stTabs [data-baseweb="tab-list"] {
        gap: 8px;
    }
    
    .stTabs [data-baseweb="tab"] {
        border-radius: 10px;
        padding: 0.5rem 1rem;
        font-weight: bold;
    }
    
    /* DataFrame */
    .dataframe {
        border-radius: 10px;
        overflow: hidden;
    }
    
    /* Footer */
    .footer {
        text-align: center;
        padding: 1rem;
        margin-top: 2rem;
        color: #666;
        font-size: 0.8rem;
    }
    </style>
    """, unsafe_allow_html=True)