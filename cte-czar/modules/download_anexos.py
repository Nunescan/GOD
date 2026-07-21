import os
import zipfile
from pathlib import Path
from datetime import datetime, timedelta
import win32com.client
import pythoncom
import re
import shutil
import tempfile
import email
from email import policy
from email.parser import BytesParser
import hashlib
import json

class DownloadAnexos:
    def __init__(self, pasta_base=None):
        if pasta_base is None:
            self.pasta_base = Path(__file__).parent.parent / "downloads" / "CTEs"
        else:
            self.pasta_base = Path(pasta_base)
        
        self.pasta_base.mkdir(parents=True, exist_ok=True)
        
        self.controle_arquivos = self.pasta_base / ".controle_duplicados.json"
        self.arquivos_baixados = self._carregar_controle()
        
        print(f"📁 Pasta base: {self.pasta_base}")
        
        self.extensoes_permitidas = ['.pdf', '.xml', '.zip', '.eml']
        self.extensoes_ignorar = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', 
                                  '.tmp', '.dat', '.exe', '.bat', '.msg']
    
    def _carregar_controle(self):
        if self.controle_arquivos.exists():
            try:
                with open(self.controle_arquivos, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except:
                return {}
        return {}
    
    def _salvar_controle(self):
        try:
            with open(self.controle_arquivos, 'w', encoding='utf-8') as f:
                json.dump(self.arquivos_baixados, f, indent=4)
        except Exception as e:
            print(f"Erro ao salvar controle: {e}")
    
    def _calcular_hash(self, arquivo):
        hash_md5 = hashlib.md5()
        try:
            with open(arquivo, "rb") as f:
                for chunk in iter(lambda: f.read(4096), b""):
                    hash_md5.update(chunk)
            return hash_md5.hexdigest()
        except:
            return None
    
    def _verificar_duplicado(self, arquivo, nome_original):
        if not arquivo.exists():
            return False
        
        hash_arquivo = self._calcular_hash(arquivo)
        if not hash_arquivo:
            return False
        
        if hash_arquivo in self.arquivos_baixados:
            print(f"⏭️ Duplicado ignorado: {nome_original}")
            return True
        
        self.arquivos_baixados[hash_arquivo] = {
            'nome': arquivo.name,
            'data': datetime.now().isoformat(),
            'original': nome_original
        }
        self._salvar_controle()
        return False
    
    def limpar_pasta_armador(self, armador):
        pasta_armador = self.pasta_base / armador
        if pasta_armador.exists():
            shutil.rmtree(pasta_armador)
            print(f"🧹 Pasta {armador} limpa!")
        pasta_armador.mkdir(parents=True, exist_ok=True)
        return True
    
    def _mover_para_principal(self, arquivo_origem, pasta_destino):
        arquivo_origem = Path(arquivo_origem)
        pasta_destino = Path(pasta_destino)
        
        if not arquivo_origem.exists():
            return None
        
        nome_destino = pasta_destino / arquivo_origem.name
        contador = 1
        while nome_destino.exists():
            nome = arquivo_origem.stem
            ext = arquivo_origem.suffix
            nome_destino = pasta_destino / f"{nome}_{contador}{ext}"
            contador += 1
        
        shutil.move(str(arquivo_origem), str(nome_destino))
        return nome_destino
    
    def baixar_todos_anexos_da_pasta(self, pasta_nome, armador, scanner, dias=999):
        pythoncom.CoInitialize()
        
        arquivos_baixados = []
        
        pasta_outlook = self._encontrar_pasta_outlook(pasta_nome, scanner)
        
        if not pasta_outlook:
            print(f"❌ Pasta não encontrada: {pasta_nome}")
            return arquivos_baixados
        
        pasta_armador = self.pasta_base / armador
        pasta_armador.mkdir(parents=True, exist_ok=True)
        pasta_temp = self.pasta_base / f"_temp_{armador}"
        pasta_temp.mkdir(parents=True, exist_ok=True)
        
        print(f"\n{'='*50}")
        print(f"📁 Processando pasta: {pasta_nome} -> {pasta_armador}")
        print(f"{'='*50}")
        
        try:
            itens = pasta_outlook.Items
            # mais recentes primeiro: assim, com a pasta ordenada, da pra parar assim
            # que passar do periodo pedido, sem precisar varrer o resto da pasta
            try:
                itens.Sort("[ReceivedTime]", True)
            except Exception as e:
                print(f"⚠️ Não foi possível ordenar por data (seguindo sem ordenar): {e}")

            total_itens = itens.Count
            print(f"📧 Total de itens na pasta: {total_itens}")

            # antes, o "periodo (dias)" nao filtrava nada de verdade e a pasta parava
            # sempre no item 999, descartando o resto sem avisar. Agora filtra por
            # data de verdade e processa a pasta inteira dentro do periodo pedido.
            data_limite = datetime.now() - timedelta(days=dias)

            itens_processados = 0
            for i in range(1, total_itens + 1):
                try:
                    item = itens.Item(i)

                    if hasattr(item, 'Class') and item.Class == 43:
                        if hasattr(item, 'ReceivedTime') and hasattr(item.ReceivedTime, 'strftime'):
                            try:
                                recebido_em = datetime(item.ReceivedTime.year, item.ReceivedTime.month, item.ReceivedTime.day)
                                if recebido_em < data_limite:
                                    # itens ordenados do mais novo pro mais antigo: a partir
                                    # daqui todos os seguintes tambem estarao fora do periodo
                                    print(f"⏹️ Fim do período ({dias} dias) alcançado em {itens_processados} e-mails processados")
                                    break
                            except Exception:
                                pass

                        itens_processados += 1

                        if hasattr(item, 'Attachments') and item.Attachments.Count > 0:
                            
                            data_email = ""
                            if hasattr(item, 'ReceivedTime'):
                                try:
                                    if hasattr(item.ReceivedTime, 'strftime'):
                                        data_email = item.ReceivedTime.strftime("%Y%m%d")
                                    else:
                                        data_email = datetime.now().strftime("%Y%m%d")
                                except:
                                    data_email = datetime.now().strftime("%Y%m%d")
                            
                            for j in range(1, item.Attachments.Count + 1):
                                try:
                                    anexo = item.Attachments.Item(j)
                                    nome_arquivo = anexo.FileName
                                    extensao = Path(nome_arquivo).suffix.lower()
                                    
                                    if any(extensao == ign for ign in self.extensoes_ignorar):
                                        continue
                                    
                                    if extensao in self.extensoes_permitidas:
                                        
                                        nome_base = Path(nome_arquivo).stem
                                        nome_base = re.sub(r'[<>:"/\\|?*]', '', nome_base)
                                        
                                        if data_email:
                                            nome_temp = f"{data_email}_{nome_base}{extensao}"
                                        else:
                                            nome_temp = f"{nome_base}{extensao}"
                                        
                                        caminho_temp = pasta_temp / nome_temp
                                        
                                        contador = 1
                                        while caminho_temp.exists():
                                            nome_sem_ext = Path(nome_temp).stem
                                            nome_temp = f"{nome_sem_ext}_{contador}{extensao}"
                                            caminho_temp = pasta_temp / nome_temp
                                            contador += 1
                                        
                                        anexo.SaveAsFile(str(caminho_temp))
                                        
                                        if self._verificar_duplicado(caminho_temp, nome_arquivo):
                                            caminho_temp.unlink()
                                            continue
                                        
                                        if extensao == '.zip':
                                            arquivos_proc = self._processar_zip(
                                                caminho_temp,
                                                pasta_temp / f"{Path(nome_temp).stem}_extraido",
                                                pasta_armador
                                            )
                                            arquivos_baixados.extend(arquivos_proc)
                                            
                                            if caminho_temp.exists():
                                                caminho_temp.unlink()
                                        
                                        elif extensao == '.eml':
                                            arquivos_eml = self._processar_eml(
                                                caminho_temp,
                                                pasta_temp / f"{Path(nome_temp).stem}_anexos",
                                                pasta_armador
                                            )
                                            arquivos_baixados.extend(arquivos_eml)
                                            
                                            if caminho_temp.exists():
                                                caminho_temp.unlink()
                                        
                                        else:
                                            destino = self._mover_para_principal(caminho_temp, pasta_armador)
                                            if destino:
                                                arquivos_baixados.append({
                                                    'nome': destino.name,
                                                    'tipo': extensao[1:],
                                                    'caminho': str(destino),
                                                    'original': nome_arquivo,
                                                    'fonte': 'direto'
                                                })
                                        
                                except Exception as e:
                                    print(f"Erro no anexo: {e}")
                                    continue
                    
                    if i % 100 == 0:
                        print(f"📊 Processados {i}/{total_itens} itens...")
                        
                except Exception as e:
                    print(f"Erro no item {i}: {e}")
                    continue
            
            if pasta_temp.exists():
                shutil.rmtree(pasta_temp, ignore_errors=True)
                
        except Exception as e:
            print(f"❌ Erro na pasta: {e}")
        
        print(f"✅ Pasta {pasta_nome}: {len(arquivos_baixados)} arquivos baixados")
        return arquivos_baixados
    
    def _processar_zip(self, arquivo_zip, pasta_destino, pasta_final):
        arquivos_processados = []
        temp_dir = None
        
        try:
            pasta_destino = Path(pasta_destino)
            pasta_destino.mkdir(parents=True, exist_ok=True)
            
            print(f"📦 Processando ZIP: {arquivo_zip.name}")
            
            temp_dir = Path(tempfile.mkdtemp())
            
            with zipfile.ZipFile(arquivo_zip, 'r') as zip_ref:
                zip_ref.extractall(temp_dir)
                
                for arquivo in temp_dir.rglob('*'):
                    if arquivo.is_file():
                        extensao = arquivo.suffix.lower()
                        
                        if extensao == '.eml':
                            anexos_eml = self._processar_arquivo_eml(
                                arquivo,
                                pasta_destino / "anexos_eml",
                                pasta_final
                            )
                            arquivos_processados.extend(anexos_eml)
                        
                        elif extensao in ['.pdf', '.xml']:
                            destino = self._mover_para_principal(arquivo, pasta_final)
                            if destino:
                                arquivos_processados.append({
                                    'nome': destino.name,
                                    'tipo': extensao[1:],
                                    'caminho': str(destino),
                                    'fonte': 'zip'
                                })
            
            print(f"✅ ZIP processado: {len(arquivos_processados)} arquivos")
            
        except Exception as e:
            print(f"❌ Erro ZIP: {e}")
        
        finally:
            if temp_dir and temp_dir.exists():
                shutil.rmtree(temp_dir, ignore_errors=True)
        
        return arquivos_processados
    
    def _processar_eml(self, arquivo_eml, pasta_destino, pasta_final):
        return self._processar_arquivo_eml(arquivo_eml, pasta_destino, pasta_final)
    
    def _processar_arquivo_eml(self, arquivo_eml, pasta_destino, pasta_final):
        anexos_encontrados = []
        
        try:
            pasta_destino = Path(pasta_destino)
            pasta_destino.mkdir(parents=True, exist_ok=True)
            
            with open(arquivo_eml, 'rb') as f:
                msg = BytesParser(policy=policy.default).parse(f)
            
            for part in msg.walk():
                if part.get_content_maintype() == 'multipart':
                    continue
                
                if part.get('Content-Disposition') is not None:
                    filename = part.get_filename()
                    
                    if filename:
                        extensao = Path(filename).suffix.lower()
                        
                        if extensao in ['.pdf', '.xml']:
                            
                            nome_base = Path(filename).stem
                            nome_base = re.sub(r'[<>:"/\\|?*]', '', nome_base)
                            
                            arquivo_temp = pasta_destino / f"{nome_base}{extensao}"
                            
                            with open(arquivo_temp, 'wb') as f_out:
                                f_out.write(part.get_payload(decode=True))
                            
                            destino = self._mover_para_principal(arquivo_temp, pasta_final)
                            
                            if destino:
                                anexos_encontrados.append({
                                    'nome': destino.name,
                                    'tipo': extensao[1:],
                                    'caminho': str(destino),
                                    'fonte': 'eml'
                                })
        
        except Exception as e:
            print(f"❌ Erro EML: {e}")
        
        return anexos_encontrados
    
    def _encontrar_pasta_outlook(self, nome_pasta, scanner, pasta_raiz=None):
        if scanner.namespace is None:
            return None
        
        if pasta_raiz is None:
            pasta_raiz = scanner.namespace.Folders
        
        try:
            for i in range(1, pasta_raiz.Count + 1):
                try:
                    pasta = pasta_raiz.Item(i)
                    
                    if pasta.Name.strip().lower() == nome_pasta.strip().lower():
                        print(f"✅ Pasta encontrada: {pasta.Name}")
                        return pasta
                    
                    if pasta.Folders.Count > 0:
                        resultado = self._encontrar_pasta_outlook(nome_pasta, scanner, pasta.Folders)
                        if resultado:
                            return resultado
                except:
                    continue
        except Exception as e:
            print(f"❌ Erro na busca: {e}")
        
        print(f"❌ Pasta não encontrada: {nome_pasta}")
        return None