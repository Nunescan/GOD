import win32com.client
import pythoncom
from pathlib import Path

class OutlookScanner:
    def __init__(self):
        self.outlook = None
        self.namespace = None
    
    def conectar_outlook(self):
        """Conecta ao Outlook"""
        try:
            pythoncom.CoInitialize()
            self.outlook = win32com.client.Dispatch("Outlook.Application")
            self.namespace = self.outlook.GetNamespace("MAPI")
            print("✅ Conectado ao Outlook")
            return True
        except Exception as e:
            print(f"❌ Erro ao conectar: {e}")
            return False
    
    def escanear_pastas(self, pasta_raiz=None):
        """Escaneia todas as pastas do Outlook"""
        if self.namespace is None:
            if not self.conectar_outlook():
                return []
        
        pastas = []
        
        def explorar(pasta_atual):
            try:
                for i in range(1, pasta_atual.Count + 1):
                    try:
                        pasta = pasta_atual.Item(i)
                        nome = pasta.Name
                        
                        if nome not in pastas:
                            pastas.append(nome)
                            print(f"📁 Pasta: {nome}")
                        
                        if pasta.Folders.Count > 0:
                            explorar(pasta.Folders)
                    except:
                        continue
            except:
                pass
        
        try:
            explorar(self.namespace.Folders)
        except Exception as e:
            print(f"❌ Erro ao escanear: {e}")
        
        return pastas

def escanear_pastas_outlook():
    """Função auxiliar"""
    scanner = OutlookScanner()
    if scanner.conectar_outlook():
        return scanner.escanear_pastas()
    return []