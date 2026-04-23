import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  getAllDocuments, 
  getDocumentsByType, 
  type Document 
} from '@/utils/documentStorage'
import { FileText, Plus, Filter, Search, Trash2 } from 'lucide-react'
import { deleteDocument } from '@/utils/documentStorage'
import { Input } from '@/components/ui/input'
import { createDocument } from '@/services/documents/DocumentService'
import { useKeyringContext } from '@/contexts/KeyringContext'
import { toast } from 'sonner'
import { useNavigate } from 'react-router-dom'
import { downloadPDF, openPDFInNewTab } from '@/utils/pdfUtils'
import { Download, Eye } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import Identicon from '@polkadot/react-identicon'

export default function Documents() {
  const { accounts, activeAccountAddress } = useKeyringContext()
  const navigate = useNavigate()
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [filterType, setFilterType] = useState<Document['type'] | 'all'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [creating, setCreating] = useState(false)
  const [selectedAccount, setSelectedAccount] = useState<string>('')
  const [dialogOpen, setDialogOpen] = useState(false)

  useEffect(() => {
    loadDocuments()
  }, [filterType])

  useEffect(() => {
    if (activeAccountAddress) {
      setSelectedAccount(activeAccountAddress)
    }
  }, [activeAccountAddress])

  const loadDocuments = async () => {
    try {
      setLoading(true)
      let docs: Document[]
      
      if (filterType === 'all') {
        docs = await getAllDocuments()
      } else {
        docs = await getDocumentsByType(filterType)
      }
      
      setDocuments(docs)
    } catch (error) {
      console.error('Error al cargar documentos:', error)
    } finally {
      setLoading(false)
    }
  }

  const getAccountDisplayName = (address: string) => {
    const account = accounts.find(acc => acc.address === address)
    return account?.meta?.name || address.slice(0, 8) + '...' + address.slice(-6)
  }

  const handleCreateTestDocument = async () => {
    if (accounts.length === 0) {
      toast.error('Necesitas tener al menos una cuenta para crear documentos')
      return
    }

    if (!selectedAccount) {
      toast.error('Por favor selecciona una cuenta como autor')
      return
    }

    const account = accounts.find(acc => acc.address === selectedAccount)
    const authorName = account?.meta?.name 
      ? `${account.meta.name} (${selectedAccount})`
      : selectedAccount

    try {
      setCreating(true)
      const testDoc = await createDocument({
        type: 'generic',
        category: 'test',
        metadata: {
          title: `Documento de Prueba ${new Date().toLocaleString('es-ES')}`,
          description: 'Este es un documento de prueba generado automáticamente',
          author: authorName, // Incluir nombre de cuenta si está disponible
          subject: 'Prueba',
          keywords: ['test', 'prueba'],
          language: 'es',
          creator: 'Yohualli Protocol',
          producer: 'Yohualli Protocol — generador PDF',
          createdAt: new Date().toISOString(),
        },
        pdfContent: {
          title: 'Documento de Prueba',
          subtitle: `Autor: ${authorName}`,
          sections: [
            {
              title: 'Información',
              content: 'Este es un documento PDF de prueba generado por Yohualli Protocol. El sistema de documentos está funcionando correctamente.',
            },
            {
              title: 'Detalles del Autor',
              content: [
                ['Campo', 'Valor'],
                ['Dirección', selectedAccount],
                ['Nombre', account?.meta?.name || 'Sin nombre'],
                ['Tipo', account?.type || 'N/A'],
              ],
              isTable: true,
            },
            {
              title: 'Detalles del Documento',
              content: [
                ['Campo', 'Valor'],
                ['Tipo', 'Documento Genérico'],
                ['Fecha', new Date().toLocaleString('es-ES')],
                ['Estado', 'Activo'],
              ],
              isTable: true,
            },
          ],
          footer: `Generado el ${new Date().toLocaleDateString('es-ES')} por ${authorName} usando Yohualli Protocol`,
        },
        relatedAccount: selectedAccount,
      })

      toast.success('Documento creado exitosamente')
      setDialogOpen(false)
      await loadDocuments()
    } catch (error) {
      console.error('Error al crear documento:', error)
      toast.error('Error al crear documento')
    } finally {
      setCreating(false)
    }
  }

  const filteredDocuments = documents.filter(doc => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      doc.metadata.title?.toLowerCase().includes(query) ||
      doc.metadata.description?.toLowerCase().includes(query) ||
      doc.documentId.toLowerCase().includes(query) ||
      doc.category?.toLowerCase().includes(query)
    )
  })

  const getTypeBadgeVariant = (type: Document['type']) => {
    switch (type) {
      case 'contract':
        return 'default'
      case 'flight_log':
        return 'secondary'
      case 'medical_record':
        return 'destructive'
      case 'attestation':
        return 'outline'
      default:
        return 'secondary'
    }
  }

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const handleViewDocument = (doc: Document) => {
    if (!doc.pdf) {
      toast.error('El PDF no está disponible')
      return
    }
    try {
      openPDFInNewTab(doc.pdf)
    } catch (error) {
      console.error('Error al abrir PDF:', error)
      toast.error('Error al abrir el PDF')
    }
  }

  const handleDownloadDocument = (doc: Document) => {
    if (!doc.pdf) {
      toast.error('El PDF no está disponible')
      return
    }
    try {
      const filename = doc.metadata.title || `documento-${doc.documentId.slice(0, 8)}`
      downloadPDF(doc.pdf, filename)
      toast.success('PDF descargado')
    } catch (error) {
      console.error('Error al descargar PDF:', error)
      toast.error('Error al descargar el PDF')
    }
  }

  const handleViewDetails = (documentId: string) => {
    navigate(`/documents/${documentId}`)
  }

  const handleDeleteDocument = async (documentId: string, title?: string) => {
    if (!confirm(`¿Estás seguro de que deseas eliminar el documento "${title || documentId}"? Esta acción no se puede deshacer.`)) {
      return
    }

    try {
      await deleteDocument(documentId)
      toast.success('Documento eliminado exitosamente')
      await loadDocuments()
    } catch (error) {
      console.error('Error al eliminar documento:', error)
      toast.error('Error al eliminar el documento')
    }
  }

  return (
    <div className="container mx-auto p-3 sm:p-4 pb-6 sm:pb-8 space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold">Documentos</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">
            Gestiona tus documentos PDF, contratos y registros
          </p>
        </div>
        <Button 
          onClick={() => navigate('/documents/new')}
          className="w-full sm:w-auto"
        >
          <Plus className="mr-2 h-4 w-4" />
          <span className="hidden sm:inline">Crear Documento</span>
          <span className="sm:hidden">Crear</span>
        </Button>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" className="w-full sm:w-auto hidden">
              <Plus className="mr-2 h-4 w-4" />
              Crear Rápido
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px] mx-4 sm:mx-auto">
            <DialogHeader>
              <DialogTitle className="text-lg sm:text-xl">Crear Nuevo Documento</DialogTitle>
              <DialogDescription className="text-sm">
                Selecciona la cuenta que será el autor del documento
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 sm:space-y-4 py-2 sm:py-4">
              <div className="space-y-2">
                <Label htmlFor="account-select">Cuenta Autor</Label>
                <Select
                  value={selectedAccount}
                  onValueChange={setSelectedAccount}
                >
                  <SelectTrigger id="account-select">
                    <SelectValue placeholder="Selecciona una cuenta">
                      {selectedAccount && (
                        <div className="flex items-center gap-2">
                          <Identicon
                            value={selectedAccount}
                            size={16}
                            theme="polkadot"
                          />
                          <span>{getAccountDisplayName(selectedAccount)}</span>
                        </div>
                      )}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((account) => (
                      <SelectItem key={account.address} value={account.address}>
                        <div className="flex items-center gap-2">
                          <Identicon
                            value={account.address}
                            size={16}
                            theme="polkadot"
                          />
                          <div className="flex flex-col">
                            <span className="font-medium">
                              {account.meta?.name || 'Sin nombre'}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {account.address.slice(0, 8)}...{account.address.slice(-6)}
                            </span>
                          </div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedAccount && (
                  <p className="text-sm text-muted-foreground">
                    El autor del PDF será: {getAccountDisplayName(selectedAccount)}
                  </p>
                )}
              </div>
            </div>
            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={creating}
                className="w-full sm:w-auto"
              >
                Cancelar
              </Button>
              <Button 
                onClick={handleCreateTestDocument} 
                disabled={creating || !selectedAccount}
                className="w-full sm:w-auto"
              >
                {creating ? 'Creando...' : 'Crear Documento'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filtros y búsqueda */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base sm:text-lg">Filtros</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 sm:space-y-4">
          <div className="flex flex-col gap-3 sm:gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar documentos..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 text-sm sm:text-base"
                />
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button
                variant={filterType === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterType('all')}
                className="text-xs sm:text-sm"
              >
                Todos
              </Button>
              <Button
                variant={filterType === 'contract' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterType('contract')}
                className="text-xs sm:text-sm"
              >
                Contratos
              </Button>
              <Button
                variant={filterType === 'flight_log' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterType('flight_log')}
                className="text-xs sm:text-sm"
              >
                Vuelos
              </Button>
              <Button
                variant={filterType === 'medical_record' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterType('medical_record')}
                className="text-xs sm:text-sm"
              >
                Médicos
              </Button>
              <Button
                variant={filterType === 'generic' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterType('generic')}
                className="text-xs sm:text-sm"
              >
                Genéricos
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de documentos */}
      {loading ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">
              Cargando documentos...
            </div>
          </CardContent>
        </Card>
      ) : filteredDocuments.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center space-y-4">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground" />
              <div>
                <h3 className="text-lg font-semibold">No hay documentos</h3>
                <p className="text-muted-foreground mt-1">
                  {searchQuery || filterType !== 'all'
                    ? 'No se encontraron documentos con los filtros aplicados'
                    : 'Comienza creando tu primer documento'}
                </p>
              </div>
              {!searchQuery && filterType === 'all' && (
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="mt-4">
                      <Plus className="mr-2 h-4 w-4" />
                      Crear Primer Documento
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[500px] mx-4 sm:mx-auto">
                    <DialogHeader>
                      <DialogTitle className="text-lg sm:text-xl">Crear Nuevo Documento</DialogTitle>
                      <DialogDescription className="text-sm">
                        Selecciona la cuenta que será el autor del documento
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3 sm:space-y-4 py-2 sm:py-4">
                      <div className="space-y-2">
                        <Label htmlFor="account-select-empty">Cuenta Autor</Label>
                        <Select
                          value={selectedAccount}
                          onValueChange={setSelectedAccount}
                        >
                          <SelectTrigger id="account-select-empty">
                            <SelectValue placeholder="Selecciona una cuenta">
                              {selectedAccount && (
                                <div className="flex items-center gap-2">
                                  <Identicon
                                    value={selectedAccount}
                                    size={16}
                                    theme="polkadot"
                                  />
                                  <span>{getAccountDisplayName(selectedAccount)}</span>
                                </div>
                              )}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {accounts.map((account) => (
                              <SelectItem key={account.address} value={account.address}>
                                <div className="flex items-center gap-2">
                                  <Identicon
                                    value={account.address}
                                    size={16}
                                    theme="polkadot"
                                  />
                                  <div className="flex flex-col">
                                    <span className="font-medium">
                                      {account.meta?.name || 'Sin nombre'}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                      {account.address.slice(0, 8)}...{account.address.slice(-6)}
                                    </span>
                                  </div>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {selectedAccount && (
                          <p className="text-sm text-muted-foreground">
                            El autor del PDF será: {getAccountDisplayName(selectedAccount)}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-2">
                      <Button
                        variant="outline"
                        onClick={() => setDialogOpen(false)}
                        disabled={creating}
                        className="w-full sm:w-auto"
                      >
                        Cancelar
                      </Button>
                      <Button 
                        onClick={handleCreateTestDocument} 
                        disabled={creating || !selectedAccount}
                        className="w-full sm:w-auto"
                      >
                        {creating ? 'Creando...' : 'Crear Documento'}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {filteredDocuments.map((doc) => (
            <Card key={doc.documentId} className="hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base sm:text-lg line-clamp-2">
                      {doc.metadata.title || 'Documento sin título'}
                    </CardTitle>
                    <CardDescription className="mt-1 text-xs sm:text-sm">
                      {formatDate(doc.createdAt)}
                    </CardDescription>
                  </div>
                  <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground flex-shrink-0" />
                </div>
              </CardHeader>
              <CardContent className="space-y-3 sm:space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Badge variant={getTypeBadgeVariant(doc.type)}>
                    {doc.type === 'contract' ? 'Contrato' :
                     doc.type === 'flight_log' ? 'Vuelo' :
                     doc.type === 'medical_record' ? 'Médico' :
                     doc.type === 'attestation' ? 'Atestación' :
                     doc.type === 'generic' ? 'Genérico' : 'Otro'}
                  </Badge>
                  {doc.signatureStatus && (
                    <Badge variant={
                      doc.signatureStatus === 'fully_signed' ? 'default' :
                      doc.signatureStatus === 'pending' ? 'secondary' :
                      'destructive'
                    }>
                      {doc.signatureStatus === 'fully_signed' ? 'Firmado' :
                       doc.signatureStatus === 'pending' ? 'Pendiente' :
                       doc.signatureStatus === 'partially_signed' ? 'Parcial' :
                       doc.signatureStatus === 'expired' ? 'Expirado' : 'Rechazado'}
                    </Badge>
                  )}
                  {doc.encrypted && (
                    <Badge variant="outline">Encriptado</Badge>
                  )}
                </div>

                {doc.metadata.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {doc.metadata.description}
                  </p>
                )}

                <div className="flex items-center justify-between text-xs sm:text-sm text-muted-foreground">
                  <span>{formatFileSize(doc.pdfSize)}</span>
                  <span>{doc.signatures.length} firma{doc.signatures.length !== 1 ? 's' : ''}</span>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex-1 text-xs sm:text-sm"
                    onClick={() => handleViewDetails(doc.documentId)}
                  >
                    <Eye className="mr-1.5 sm:mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    <span className="hidden sm:inline">Ver Detalles</span>
                    <span className="sm:hidden">Ver</span>
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex-1 text-xs sm:text-sm"
                    onClick={() => handleDownloadDocument(doc)}
                  >
                    <Download className="mr-1.5 sm:mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    Descargar
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex-1 text-xs sm:text-sm text-destructive hover:text-destructive"
                    onClick={() => handleDeleteDocument(doc.documentId, doc.metadata.title)}
                  >
                    <Trash2 className="mr-1.5 sm:mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    Eliminar
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
