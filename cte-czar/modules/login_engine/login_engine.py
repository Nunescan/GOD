import os
import re
import shutil
import time
from pathlib import Path
import PyPDF2
from PyPDF2 import PdfReader, PdfWriter
import pdf2image
import tempfile
import cv2
import numpy as np
import pytesseract
import pickle

# Configurações
# Caminhos do Tesseract/Poppler: antes fixos pro perfil "caanunes" de outro PC,
# o que quebrava aqui. Agora vem de variavel de ambiente (defina em cte-czar/.env
# se instalar em local nao-padrao) com fallback pro PATH do sistema.
_TESSERACT_CMD = os.environ.get('TESSERACT_CMD', 'tesseract')
POPPLER_PATH = os.environ.get('POPPLER_PATH') or None

pytesseract.pytesseract.tesseract_cmd = _TESSERACT_CMD
# se TESSDATA_PREFIX ja estiver definida no ambiente, o tesseract usa ela sozinho;
# senao, ele acha a pasta tessdata automaticamente ao lado do proprio executavel

class LoginEngine:
    def __init__(self):
        self.patterns = {
            'cte_numero': [
                r'NRO\.\s*DOCUMENTO\s*(\d+)',
                r'CT[-\s]?E[\s:]*(\d+)',
                r'CTE[\s:]*(\d+)',
                r'CONHECIMENTO\s*[:\s]*(\d+)',
            ]
        }
        
        self.modelo = None
        self.modelo_nome = None
        self.regiao_do_numero = None
        
        self.resultados = {
            'arquivos_originais': [],
            'paginas_extraidas': []
        }
    
    def configurar_template(self, imagem_template):
        try:
            print(f"\n📸 Carregando template: {imagem_template.name}")
            template_bytes = np.frombuffer(imagem_template.read(), np.uint8)
            self.modelo = cv2.imdecode(template_bytes, cv2.IMREAD_GRAYSCALE)
            self.modelo_nome = imagem_template.name
            print(f"  ✅ Template carregado! Dimensões: {self.modelo.shape}")
            return True
        except Exception as e:
            print(f"❌ Erro ao carregar template: {e}")
            return False
    
    def detectar_retangulo_vermelho(self, imagem):
        try:
            hsv = cv2.cvtColor(imagem, cv2.COLOR_BGR2HSV)
            
            vermelho_baixo1 = np.array([0, 50, 50])
            vermelho_alto1 = np.array([20, 255, 255])
            mascara1 = cv2.inRange(hsv, vermelho_baixo1, vermelho_alto1)
            
            vermelho_baixo2 = np.array([160, 50, 50])
            vermelho_alto2 = np.array([180, 255, 255])
            mascara2 = cv2.inRange(hsv, vermelho_baixo2, vermelho_alto2)
            
            mascara = cv2.bitwise_or(mascara1, mascara2)
            mascara = cv2.GaussianBlur(mascara, (5, 5), 0)
            
            contornos, _ = cv2.findContours(mascara, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            
            if contornos:
                maior = max(contornos, key=cv2.contourArea)
                x, y, w, h = cv2.boundingRect(maior)
                
                if w > 20 and h > 10:
                    print(f"  ✅ Retângulo vermelho detectado: x={x}, y={y}, w={w}, h={h}")
                    return (x, y, w, h)
            
            return None
        except Exception as e:
            print(f"  ❌ Erro ao detectar retângulo: {e}")
            return None
    
    def ensinar_com_exemplo(self, imagem_exemplo):
        try:
            print(f"\n🎓 Ensinando novo padrão...")
            
            exemplo_bytes = np.frombuffer(imagem_exemplo.read(), np.uint8)
            imagem_colorida = cv2.imdecode(exemplo_bytes, cv2.IMREAD_COLOR)
            
            regiao = self.detectar_retangulo_vermelho(imagem_colorida)
            
            if regiao is None:
                print(f"❌ Não foi possível detectar o retângulo vermelho")
                return False
            
            x, y, w, h = regiao
            
            self.modelo = cv2.cvtColor(imagem_colorida, cv2.COLOR_BGR2GRAY)
            self.modelo_nome = imagem_exemplo.name
            self.regiao_do_numero = (x, y, w, h)
            
            print(f"  ✅ Modelo carregado: {self.modelo_nome}")
            print(f"  📍 Região do número: x={x}, y={y}, largura={w}, altura={h}")
            
            regiao_numero = imagem_colorida[y:y+h, x:x+w]
            cv2.imwrite("regiao_do_numero.png", regiao_numero)
            
            with open('modelo_login.pkl', 'wb') as f:
                pickle.dump({
                    'modelo': self.modelo,
                    'regiao': self.regiao_do_numero,
                    'nome': self.modelo_nome
                }, f)
            
            return True
        except Exception as e:
            print(f"❌ Erro ao ensinar: {e}")
            return False
    
    def carregar_modelo(self):
        try:
            if os.path.exists('modelo_login.pkl'):
                with open('modelo_login.pkl', 'rb') as f:
                    dados = pickle.load(f)
                    self.modelo = dados['modelo']
                    self.regiao_do_numero = dados['regiao']
                    self.modelo_nome = dados['nome']
                print(f"✅ Modelo carregado: {self.modelo_nome}")
                return True
        except:
            pass
        return False
    
    def encontrar_numero_no_pdf(self, imagem_pagina):
        if self.modelo is None:
            return None
        
        try:
            pagina_gray = cv2.cvtColor(imagem_pagina, cv2.COLOR_BGR2GRAY)
            resultado = cv2.matchTemplate(pagina_gray, self.modelo, cv2.TM_CCOEFF_NORMED)
            min_val, max_val, min_loc, max_loc = cv2.minMaxLoc(resultado)
            
            if max_val > 0.7:
                x_modelo, y_modelo = max_loc
                h_modelo, w_modelo = self.modelo.shape
                x_rel, y_rel, w_rel, h_rel = self.regiao_do_numero
                
                x_numero = x_modelo + x_rel
                y_numero = y_modelo + y_rel
                
                regiao_numero = pagina_gray[
                    y_numero:y_numero + h_rel,
                    x_numero:x_numero + w_rel
                ]
                
                texto_numero = pytesseract.image_to_string(
                    regiao_numero,
                    config='--psm 8 -c tessedit_char_whitelist=0123456789'
                )
                
                numeros = re.findall(r'\d+', texto_numero)
                if numeros:
                    return max(numeros, key=len)
        except Exception as e:
            print(f"Erro ao buscar número: {e}")
        
        return None
    
    def _extrair_numero_cte_do_texto(self, texto):
        for pattern in self.patterns['cte_numero']:
            match = re.search(pattern, texto, re.IGNORECASE)
            if match:
                numero = match.group(1)
                numero = re.sub(r'[.\s\-]', '', str(numero))
                return numero
        return None
    
    def processar_arquivos(self, pasta_origem, pasta_destino):
        pasta_origem = Path(pasta_origem)
        pasta_destino = Path(pasta_destino)
        
        self.carregar_modelo()
        
        pasta_originais = pasta_destino / "1_arquivos_inteiros"
        pasta_extraidas = pasta_destino / "2_paginas_cortadas"
        
        pasta_originais.mkdir(parents=True, exist_ok=True)
        pasta_extraidas.mkdir(parents=True, exist_ok=True)
        
        arquivos_pdf = list(pasta_origem.glob("*.pdf"))
        
        print(f"\n📁 Encontrados {len(arquivos_pdf)} arquivos PDF")
        
        resultados = {
            'arquivos_originais': [],
            'paginas_extraidas': []
        }
        
        for pdf_path in arquivos_pdf:
            print(f"\n{'='*50}")
            print(f"📄 Processando: {pdf_path.name}")
            print(f"{'='*50}")
            
            destino_original = pasta_originais / pdf_path.name
            shutil.copy2(pdf_path, destino_original)
            
            resultados['arquivos_originais'].append({
                'arquivo': pdf_path.name,
                'caminho': str(destino_original)
            })
            
            try:
                with open(pdf_path, 'rb') as f:
                    reader = PdfReader(f)
                    total_paginas = len(reader.pages)
                
                print(f"  📄 Total de páginas: {total_paginas}")
                
                for i in range(total_paginas):
                    print(f"\n  🔍 Página {i+1}/{total_paginas}")
                    
                    with tempfile.TemporaryDirectory() as temp_dir:
                        imagens = pdf2image.convert_from_path(
                            pdf_path,
                            dpi=300,
                            first_page=i+1,
                            last_page=i+1,
                            output_folder=temp_dir,
                            fmt='png',
                            poppler_path=POPPLER_PATH
                        )
                        
                        if not imagens:
                            continue
                        
                        imagem = imagens[0]
                        imagem_cv = cv2.cvtColor(np.array(imagem), cv2.COLOR_RGB2BGR)
                        
                        numero_cte = None
                        
                        if self.modelo is not None:
                            numero_cte = self.encontrar_numero_no_pdf(imagem_cv)
                        
                        if not numero_cte:
                            texto = pytesseract.image_to_string(imagem_cv, lang='por')
                            numero_cte = self._extrair_numero_cte_do_texto(texto)
                        
                        if numero_cte:
                            nome_arquivo = f"{numero_cte}.pdf"
                            print(f"    ✅ CTE encontrado: {numero_cte}")
                        else:
                            nome_arquivo = f"pagina_{i+1}_sem_cte.pdf"
                            print(f"    ❌ CTE não encontrado")
                        
                        writer = PdfWriter()
                        with open(pdf_path, 'rb') as f:
                            reader = PdfReader(f)
                            writer.add_page(reader.pages[i])
                        
                        caminho_pagina = pasta_extraidas / nome_arquivo
                        
                        contador = 1
                        while caminho_pagina.exists():
                            if numero_cte:
                                nome_arquivo = f"{numero_cte}_{contador}.pdf"
                            else:
                                nome_arquivo = f"pagina_{i+1}_sem_cte_{contador}.pdf"
                            caminho_pagina = pasta_extraidas / nome_arquivo
                            contador += 1
                        
                        with open(caminho_pagina, 'wb') as output:
                            writer.write(output)
                        
                        resultados['paginas_extraidas'].append({
                            'arquivo_original': pdf_path.name,
                            'pagina': i+1,
                            'total_paginas': total_paginas,
                            'cte': numero_cte,
                            'arquivo_gerado': nome_arquivo,
                            'caminho': str(caminho_pagina)
                        })
                        
                        time.sleep(0.1)
                        
            except Exception as e:
                print(f"  ❌ Erro: {e}")
        
        print(f"\n{'='*50}")
        print(f"✅ PROCESSAMENTO CONCLUÍDO!")
        print(f"{'='*50}")
        print(f"  Arquivos originais: {len(resultados['arquivos_originais'])}")
        print(f"  Páginas extraídas: {len(resultados['paginas_extraidas'])}")
        
        com_cte = len([p for p in resultados['paginas_extraidas'] if p.get('cte')])
        sem_cte = len([p for p in resultados['paginas_extraidas'] if not p.get('cte')])
        print(f"  Com CTE: {com_cte}")
        print(f"  Sem CTE: {sem_cte}")
        
        return resultados
    
    def obter_estatisticas(self, resultados):
        return {
            'total_originais': len(resultados['arquivos_originais']),
            'total_paginas': len(resultados['paginas_extraidas']),
            'com_cte': len([p for p in resultados['paginas_extraidas'] if p.get('cte')]),
            'sem_cte': len([p for p in resultados['paginas_extraidas'] if not p.get('cte')])
        }