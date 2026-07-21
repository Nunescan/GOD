import os
import re
import xml.etree.ElementTree as ET
from pathlib import Path
from collections import defaultdict
import pandas as pd
from datetime import datetime
import traceback

class RelatorioMercosul:
    def __init__(self):
        self.cnpj_map = {
            'SEARA ALIMENTOS': '30',
            'SEARA COMERCIO': '178',
            'JBS AVES': '36',
            'SEARA ALIMENTOS LTDA': '30',
            'JBS AVES LTDA': '36',
            'SEARA COMERCIO DE ALIMENTOS': '178'
        }
        
        self.dados_coletados = []
        self.container_map = defaultdict(list)
    
    def _extrair_numero_cte_do_nome(self, nome_arquivo):
        match = re.match(r'(\d+)\s*-\s*', nome_arquivo)
        if match:
            return match.group(1)
        return None
    
    def _encontrar_tag(self, root, tag_name):
        for elem in root.iter():
            if '}' in elem.tag:
                tag = elem.tag.split('}')[-1]
            else:
                tag = elem.tag
            if tag == tag_name:
                return elem
        return None
    
    def _extrair_texto_tag(self, root, tag_name):
        elem = self._encontrar_tag(root, tag_name)
        if elem is not None and elem.text:
            return elem.text.strip()
        return None
    
    def _extrair_info_rem(self, root):
        try:
            for elem in root.iter():
                if '}' in elem.tag:
                    tag = elem.tag.split('}')[-1]
                else:
                    tag = elem.tag
                
                if tag == 'rem':
                    cnpj = None
                    nome = None
                    
                    for subelem in elem.iter():
                        if '}' in subelem.tag:
                            subtag = subelem.tag.split('}')[-1]
                        else:
                            subtag = subelem.tag
                        
                        if subtag == 'CNPJ' and subelem.text:
                            cnpj = subelem.text.strip()
                        if subtag == 'xNome' and subelem.text:
                            nome = subelem.text.upper()
                    
                    if cnpj and nome:
                        codigo = None
                        for key, value in self.cnpj_map.items():
                            if key in nome:
                                codigo = value
                                break
                        
                        filial = self._extrair_filial_cnpj(cnpj)
                        
                        return {
                            'cnpj': cnpj,
                            'codigo': codigo,
                            'filial': filial,
                            'nome': nome
                        }
        except Exception as e:
            print(f"Erro ao extrair info do rem: {e}")
        return None
    
    def _extrair_filial_cnpj(self, cnpj):
        if not cnpj:
            return None
        match = re.search(r'/(\d+)-', str(cnpj))
        if match:
            filial = match.group(1)
            filial = filial.lstrip('0')
            return filial if filial else '0'
        return None
    
    def _extrair_container_xml(self, root):
        try:
            texto_completo = ET.tostring(root, encoding='unicode')
            padroes = [r'([A-Z]{4}\d{7})', r'Container[:\s]*([A-Z]{4}\d{7})']
            for padrao in padroes:
                match = re.search(padrao, texto_completo)
                if match:
                    return match.group(1)
        except:
            pass
        return None
    
    def _extrair_notas_fiscais(self, root):
        notas = []
        try:
            for elem in root.iter():
                if '}' in elem.tag:
                    tag = elem.tag.split('}')[-1]
                else:
                    tag = elem.tag
                
                if tag == 'infNFe':
                    for subelem in elem.iter():
                        if '}' in subelem.tag:
                            subtag = subelem.tag.split('}')[-1]
                        else:
                            subtag = subelem.tag
                        
                        if subtag == 'chave' and subelem.text:
                            chave = subelem.text.strip()
                            if len(chave) > 30:
                                numero = chave[25:34]
                                numero_limpo = numero.lstrip('0')
                                if numero_limpo:
                                    notas.append(numero_limpo)
        except Exception as e:
            print(f"Erro ao extrair notas fiscais: {e}")
        return notas
    
    def _extrair_valor_componente(self, root, nome_componente):
        try:
            for elem in root.iter():
                if '}' in elem.tag:
                    tag = elem.tag.split('}')[-1]
                else:
                    tag = elem.tag
                
                if tag == 'Comp':
                    xnome = None
                    vcomp = None
                    
                    for subelem in elem.iter():
                        if '}' in subelem.tag:
                            subtag = subelem.tag.split('}')[-1]
                        else:
                            subtag = subelem.tag
                        
                        if subtag == 'xNome' and subelem.text:
                            xnome = subelem.text.upper()
                        if subtag == 'vComp' and subelem.text:
                            vcomp = subelem.text.replace(',', '.').strip()
                    
                    if xnome and nome_componente.upper() in xnome:
                        if vcomp:
                            return float(vcomp)
        except:
            pass
        return 0.0
    
    def extrair_informacoes_xml(self, xml_path):
        try:
            tree = ET.parse(xml_path)
            root = tree.getroot()
            
            numero_cte = self._extrair_numero_cte_do_nome(xml_path.name)
            
            if not numero_cte:
                nCT = self._extrair_texto_tag(root, 'nCT')
                if nCT:
                    numero_cte = nCT
            
            if not numero_cte:
                return None
            
            data_emi = self._extrair_texto_tag(root, 'dhEmi')
            if data_emi:
                data_emi = data_emi[:10]
            
            origem = self._extrair_texto_tag(root, 'xMunIni')
            destino = self._extrair_texto_tag(root, 'xMunFim')
            container = self._extrair_container_xml(root)
            
            # Extrai proposta
            proposta = None
            xObs = self._extrair_texto_tag(root, 'xObs')
            if xObs:
                match = re.search(r'PC:\d+/(\d+)', xObs)
                if match:
                    proposta = match.group(1)
            
            info_rem = self._extrair_info_rem(root)
            cnpj_completo = info_rem['cnpj'] if info_rem else None
            codigo = info_rem['codigo'] if info_rem else None
            filial = info_rem['filial'] if info_rem else None
            
            notas = self._extrair_notas_fiscais(root)
            
            ad_valorem = self._extrair_valor_componente(root, 'AD VALOREM')
            baf = self._extrair_valor_componente(root, 'BAF')
            frete_bruto = self._extrair_valor_componente(root, 'FRETE')
            parte_lote = self._extrair_valor_componente(root, 'ADIC.CARGA/DESC')
            
            frete_liquido = 0.0
            vTPrest = self._extrair_texto_tag(root, 'vTPrest')
            if vTPrest:
                try:
                    frete_liquido = float(vTPrest.replace(',', '.'))
                except:
                    pass
            
            valor_mercadoria = 0.0
            vCarga = self._extrair_texto_tag(root, 'vCarga')
            if vCarga:
                try:
                    valor_mercadoria = float(vCarga.replace(',', '.'))
                except:
                    pass
            
            icms = 0.0
            pICMS = self._extrair_texto_tag(root, 'pICMS')
            if pICMS:
                try:
                    icms = float(pICMS.replace(',', '.'))
                except:
                    pass
            
            return {
                'data_emissao': data_emi,
                'numero_cte': numero_cte,
                'origem': origem,
                'destino': destino,
                'container': container,
                'proposta': proposta,
                'cnpj': cnpj_completo,
                'codigo': codigo,
                'filial': filial,
                'notas': notas,
                'ad_valorem': ad_valorem,
                'baf': baf,
                'frete_bruto': frete_bruto,
                'parte_lote': parte_lote,
                'frete_liquido': frete_liquido,
                'valor_mercadoria': valor_mercadoria,
                'icms': icms,
                'xml_path': str(xml_path)
            }
            
        except Exception as e:
            print(f"Erro ao processar XML {xml_path.name}: {e}")
            traceback.print_exc()
            return None
    
    def gerar_relatorio(self, pasta_origem, pasta_destino=None):
        try:
            pasta_origem = Path(pasta_origem)
            
            if pasta_destino is None:
                pasta_destino = pasta_origem / "relatorios"
            else:
                pasta_destino = Path(pasta_destino)
            
            pasta_destino.mkdir(parents=True, exist_ok=True)
            
            arquivos_xml = list(pasta_origem.glob("*.xml"))
            
            if not arquivos_xml:
                return None
            
            dados = []
            container_por_cte = {}
            
            for xml_path in arquivos_xml:
                info = self.extrair_informacoes_xml(xml_path)
                if info:
                    dados.append(info)
                    if info['container']:
                        container_por_cte[info['numero_cte']] = info['container']
            
            if not dados:
                return None
            
            ctes_por_container = defaultdict(list)
            sem_container = []
            
            for info in dados:
                if info['container']:
                    ctes_por_container[info['container']].append(info)
                else:
                    sem_container.append(info)
            
            data_processamento = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            linhas = []
            
            for container, infos in ctes_por_container.items():
                ctes_lote = sorted([info['numero_cte'] for info in infos])
                ctes_lote_str = " / ".join(ctes_lote)
                
                propostas = [info.get('proposta') for info in infos if info.get('proposta')]
                propostas_unicas = list(dict.fromkeys(propostas))
                propostas_str = " / ".join(propostas_unicas) if propostas_unicas else ""
                
                todas_notas = []
                for info in infos:
                    todas_notas.extend(info.get('notas', []))
                
                notas_unicas = []
                for nota in todas_notas:
                    if nota not in notas_unicas:
                        notas_unicas.append(nota)
                
                notas_str = " / ".join(notas_unicas) if notas_unicas else ""
                
                total_ad_valorem = sum(info.get('ad_valorem', 0.0) for info in infos)
                total_baf = sum(info.get('baf', 0.0) for info in infos)
                total_frete_bruto = sum(info.get('frete_bruto', 0.0) for info in infos)
                total_parte_lote = sum(info.get('parte_lote', 0.0) for info in infos)
                total_frete_liquido = sum(info.get('frete_liquido', 0.0) for info in infos)
                total_mercadoria = sum(info.get('valor_mercadoria', 0.0) for info in infos)
                
                info_primeiro = infos[0]
                
                linha = {
                    'Container': container,
                    'CTEs': ctes_lote_str,
                    'Qtd CTEs': len(infos),
                    'Propostas': propostas_str,
                    'CNPJ': info_primeiro.get('cnpj'),
                    'Código': info_primeiro.get('codigo'),
                    'Filial': info_primeiro.get('filial'),
                    'Notas Fiscais': notas_str,
                    'Data Emissão': info_primeiro.get('data_emissao'),
                    'Origem': info_primeiro.get('origem'),
                    'Destino': info_primeiro.get('destino'),
                    'Ad Valorem (Total)': round(total_ad_valorem, 2),
                    'BAF (Total)': round(total_baf, 2),
                    'Frete Bruto (Total)': round(total_frete_bruto, 2),
                    'Parte Lote (Total)': round(total_parte_lote, 2),
                    'Frete Líquido (Total)': round(total_frete_liquido, 2),
                    'Valor Mercadoria (Total)': round(total_mercadoria, 2),
                    'ICMS %': info_primeiro.get('icms', 0.0),
                }
                linhas.append(linha)
            
            for info in sem_container:
                notas_str = " / ".join(info.get('notas', []))
                
                linha = {
                    'Container': 'NÃO IDENTIFICADO',
                    'CTEs': info['numero_cte'],
                    'Qtd CTEs': 1,
                    'Propostas': info.get('proposta', ''),
                    'CNPJ': info.get('cnpj'),
                    'Código': info.get('codigo'),
                    'Filial': info.get('filial'),
                    'Notas Fiscais': notas_str,
                    'Data Emissão': info.get('data_emissao'),
                    'Origem': info.get('origem'),
                    'Destino': info.get('destino'),
                    'Ad Valorem (Total)': round(info.get('ad_valorem', 0.0), 2),
                    'BAF (Total)': round(info.get('baf', 0.0), 2),
                    'Frete Bruto (Total)': round(info.get('frete_bruto', 0.0), 2),
                    'Parte Lote (Total)': round(info.get('parte_lote', 0.0), 2),
                    'Frete Líquido (Total)': round(info.get('frete_liquido', 0.0), 2),
                    'Valor Mercadoria (Total)': round(info.get('valor_mercadoria', 0.0), 2),
                    'ICMS %': info.get('icms', 0.0),
                }
                linhas.append(linha)
            
            if not linhas:
                return None
            
            df = pd.DataFrame(linhas)
            df = df.sort_values('Container')
            
            nome_arquivo = f"relatorio_mercosul_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
            excel_path = pasta_destino / nome_arquivo
            
            with pd.ExcelWriter(excel_path, engine='openpyxl') as writer:
                df.to_excel(writer, sheet_name='CTEs por Container', index=False)
                
                worksheet = writer.sheets['CTEs por Container']
                for i, col in enumerate(df.columns):
                    column_len = max(df[col].astype(str).map(len).max(), len(col))
                    column_len = min(column_len, 50)
                    worksheet.column_dimensions[chr(65 + i)].width = column_len + 2
            
            return {
                'excel_path': str(excel_path),
                'total_ctes': len(dados),
                'total_containers': len(linhas),
                'dados': linhas
            }
            
        except Exception as e:
            print(f"Erro ao gerar relatório: {e}")
            traceback.print_exc()
            return None