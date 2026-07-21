import pandas as pd
from pathlib import Path
from datetime import datetime

class RelatorioLogin:
    def gerar_relatorio(self, pasta_origem, pasta_destino=None):
        pasta_origem = Path(pasta_origem)
        
        if pasta_destino is None:
            pasta_destino = pasta_origem / "relatorios"
        else:
            pasta_destino = Path(pasta_destino)
        
        pasta_destino.mkdir(parents=True, exist_ok=True)
        
        pasta_originais = pasta_origem / "1_arquivos_inteiros"
        pasta_extraidas = pasta_origem / "2_paginas_cortadas"
        
        dados = []
        
        if pasta_originais.exists():
            for pdf in pasta_originais.glob("*.pdf"):
                dados.append({
                    'Tipo': 'Original',
                    'Arquivo': pdf.name,
                    'Pasta': '1_arquivos_inteiros',
                    'Caminho': str(pdf)
                })
        
        if pasta_extraidas.exists():
            for pdf in pasta_extraidas.glob("*.pdf"):
                cte = None
                nome = pdf.stem
                if nome.replace('_', '').isdigit():
                    cte = nome
                
                dados.append({
                    'Tipo': 'Página',
                    'Arquivo': pdf.name,
                    'CTE': cte if cte else 'Não identificado',
                    'Pasta': '2_paginas_cortadas',
                    'Caminho': str(pdf)
                })
        
        if not dados:
            return None
        
        df = pd.DataFrame(dados)
        
        nome_arquivo = f"relatorio_login_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
        excel_path = pasta_destino / nome_arquivo
        
        with pd.ExcelWriter(excel_path, engine='openpyxl') as writer:
            df.to_excel(writer, sheet_name='Arquivos Processados', index=False)
            
            worksheet = writer.sheets['Arquivos Processados']
            for i, col in enumerate(df.columns):
                column_len = max(df[col].astype(str).map(len).max(), len(col))
                column_len = min(column_len, 50)
                worksheet.column_dimensions[chr(65 + i)].width = column_len + 2
        
        return {
            'excel_path': str(excel_path),
            'total_arquivos': len(dados),
            'dados': dados
        }