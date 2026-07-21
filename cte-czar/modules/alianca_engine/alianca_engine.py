import os
import re
import shutil
import xml.etree.ElementTree as ET
from pathlib import Path
from collections import defaultdict
import PyPDF2
import io

class AliancaEngine:
    def __init__(self):
        self.patterns = {
            'cte_numero': [
                r'CT-E\s*(\d{3}\.\d{3}\.\d{3})',
                r'CTE\s*[:\s]*(\d+)',
                r'CONHECIMENTO\s*[:\s]*(\d+)',
                r'(\d{9,})'
            ],
            'container': [
                r'Lacre:\s*(\w{4}\d{7})',
                r'Container[:\s]*(\w{4}\d{7})',
                r'(\w{4}\d{7})'
            ]
        }
        
        self.resultados = {
            'completos': [],
            'faltando_pdf': [],
            'faltando_xml': [],
            'duplicados': []
        }
    
    def _normalizar_numero_cte(self, numero):
        if not numero:
            return None
        numero = re.sub(r'[.\s\-]', '', str(numero))
        numero = numero.lstrip('0')
        if not numero:
            numero = '0'
        return numero
    
    def extrair_numero_cte_pdf(self, pdf_path):
        try:
            with open(pdf_path, 'rb') as file:
                reader = PyPDF2.PdfReader(file)
                texto = ""
                for page in reader.pages:
                    texto += page.extract_text()
                
                for pattern in self.patterns['cte_numero']:
                    match = re.search(pattern, texto, re.IGNORECASE)
                    if match:
                        numero = match.group(1)
                        return self._normalizar_numero_cte(numero)
        except Exception as e:
            print(f"Erro ao ler PDF {pdf_path}: {e}")
        return None
    
    def extrair_numero_cte_xml(self, xml_path):
        try:
            tree = ET.parse(xml_path)
            root = tree.getroot()
            
            for elem in root.iter():
                if 'nCT' in elem.tag or 'nProt' in elem.tag:
                    if elem.text and elem.text.strip():
                        return self._normalizar_numero_cte(elem.text)
        except Exception as e:
            print(f"Erro ao ler XML {xml_path}: {e}")
        return None
    
    def extrair_container_xml(self, xml_path):
        try:
            tree = ET.parse(xml_path)
            root = tree.getroot()
            
            for elem in root.iter():
                if 'xObs' in elem.tag:
                    if elem.text:
                        texto = elem.text
                        for pattern in self.patterns['container']:
                            match = re.search(pattern, texto)
                            if match:
                                return match.group(1)
        except Exception as e:
            print(f"Erro ao extrair container do XML: {e}")
        return None
    
    def extrair_container_pdf(self, pdf_path):
        try:
            with open(pdf_path, 'rb') as file:
                reader = PyPDF2.PdfReader(file)
                texto = ""
                for page in reader.pages:
                    texto += page.extract_text()
                
                for pattern in self.patterns['container']:
                    match = re.search(pattern, texto, re.IGNORECASE)
                    if match:
                        return match.group(1)
        except Exception as e:
            print(f"Erro ao extrair container do PDF: {e}")
        return None
    
    def processar_arquivos(self, pasta_origem, pasta_destino):
        pasta_origem = Path(pasta_origem)
        pasta_destino = Path(pasta_destino)
        
        completos_dir = pasta_destino / "completos"
        faltando_dir = pasta_destino / "faltando"
        completos_pdf_dir = completos_dir / "pdfs"
        completos_xml_dir = completos_dir / "xmls"
        faltando_pdf_dir = faltando_dir / "faltando_pdf"
        faltando_xml_dir = faltando_dir / "faltando_xml"
        
        for dir_path in [completos_pdf_dir, completos_xml_dir, 
                        faltando_pdf_dir, faltando_xml_dir]:
            dir_path.mkdir(parents=True, exist_ok=True)
        
        arquivos = list(pasta_origem.glob("*.pdf")) + list(pasta_origem.glob("*.xml"))
        
        print(f"📁 Total de arquivos: {len(arquivos)}")
        
        cte_map = defaultdict(lambda: {
            'pdf': None, 
            'xml': None, 
            'pdf_path': None, 
            'xml_path': None,
            'container': None
        })
        
        container_por_cte = {}
        
        for arquivo in arquivos:
            extensao = arquivo.suffix.lower()
            
            if extensao == '.pdf':
                numero = self.extrair_numero_cte_pdf(arquivo)
                if numero:
                    cte_map[numero]['pdf'] = arquivo.name
                    cte_map[numero]['pdf_path'] = arquivo
                    container = self.extrair_container_pdf(arquivo)
                    if container:
                        container_por_cte[numero] = container
                        cte_map[numero]['container'] = container
                    print(f"📄 PDF: {numero} -> {arquivo.name}")
            
            elif extensao == '.xml':
                numero = self.extrair_numero_cte_xml(arquivo)
                if numero:
                    cte_map[numero]['xml'] = arquivo.name
                    cte_map[numero]['xml_path'] = arquivo
                    container = self.extrair_container_xml(arquivo)
                    if container:
                        container_por_cte[numero] = container
                        cte_map[numero]['container'] = container
                    print(f"📄 XML: {numero} -> {arquivo.name}")
        
        container_count = defaultdict(list)
        for cte, container in container_por_cte.items():
            if container:
                container_count[container].append(cte)
        
        print(f"\n📊 Containers encontrados:")
        for container, ctes in container_count.items():
            print(f"  {container}: {len(ctes)} CTEs: {', '.join(ctes)}")
        
        resultados = {
            'completos': [],
            'faltando_pdf': [],
            'faltando_xml': []
        }
        
        for numero_cte, info in cte_map.items():
            tem_pdf = info['pdf'] is not None
            tem_xml = info['xml'] is not None
            container = info.get('container')
            
            parte_atual = 1
            total_ocorrencias = 1
            
            if container and container in container_count:
                ctes_no_container = container_count[container]
                total_ocorrencias = len(ctes_no_container)
                ctes_ordenados = sorted(ctes_no_container)
                if numero_cte in ctes_ordenados:
                    parte_atual = ctes_ordenados.index(numero_cte) + 1
            
            if container and total_ocorrencias > 1:
                nome_base = f"{numero_cte} - parte {parte_atual} de {total_ocorrencias} - OK"
            else:
                nome_base = f"{numero_cte} - OK"
            
            if tem_pdf and tem_xml:
                destino_pdf = completos_pdf_dir / f"{nome_base}.pdf"
                destino_xml = completos_xml_dir / f"{nome_base}.xml"
                
                shutil.copy2(info['pdf_path'], destino_pdf)
                shutil.copy2(info['xml_path'], destino_xml)
                
                resultados['completos'].append({
                    'cte': numero_cte,
                    'container': container,
                    'pdf': str(destino_pdf),
                    'xml': str(destino_xml),
                    'parte': parte_atual,
                    'total': total_ocorrencias
                })
                
            elif tem_pdf and not tem_xml:
                destino_pdf = faltando_xml_dir / f"{nome_base}.pdf"
                shutil.copy2(info['pdf_path'], destino_pdf)
                
                resultados['faltando_xml'].append({
                    'cte': numero_cte,
                    'container': container,
                    'pdf': str(destino_pdf),
                    'parte': parte_atual,
                    'total': total_ocorrencias
                })
                
            elif not tem_pdf and tem_xml:
                destino_xml = faltando_pdf_dir / f"{nome_base}.xml"
                shutil.copy2(info['xml_path'], destino_xml)
                
                resultados['faltando_pdf'].append({
                    'cte': numero_cte,
                    'container': container,
                    'xml': str(destino_xml),
                    'parte': parte_atual,
                    'total': total_ocorrencias
                })
        
        arquivos_processados = set()
        for info in cte_map.values():
            if info['pdf_path']:
                arquivos_processados.add(info['pdf_path'])
            if info['xml_path']:
                arquivos_processados.add(info['xml_path'])
        
        arquivos_nao_processados = [a for a in arquivos if a not in arquivos_processados]
        
        if arquivos_nao_processados:
            nao_id_dir = pasta_destino / "nao_identificados"
            nao_id_dir.mkdir(exist_ok=True)
            for arquivo in arquivos_nao_processados:
                shutil.copy2(arquivo, nao_id_dir / arquivo.name)
        
        return resultados

    def obter_estatisticas(self, resultados):
        return {
            'total_completos': len(resultados['completos']),
            'total_faltando_pdf': len(resultados['faltando_pdf']),
            'total_faltando_xml': len(resultados['faltando_xml']),
            'total_geral': len(resultados['completos']) + 
                          len(resultados['faltando_pdf']) + 
                          len(resultados['faltando_xml'])
        }