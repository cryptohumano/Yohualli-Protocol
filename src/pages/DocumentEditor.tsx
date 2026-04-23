/**
 * Página para editar documentos antes de generar PDF
 */

import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import RichTextEditor from '@/components/documents/RichTextEditor'
import { useKeyringContext } from '@/contexts/KeyringContext'
import { createDocument } from '@/services/documents/DocumentService'
import { getDocument } from '@/utils/documentStorage'
import { toast } from 'sonner'
import { ArrowLeft, Save, FileText } from 'lucide-react'
import type { Document, DocumentType } from '@/types/documents'
import { encryptDocument } from '@/services/documents/DocumentEncryptor'
import Identicon from '@polkadot/react-identicon'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export default function DocumentEditor() {
  const { documentId } = useParams<{ documentId: string }>()
  const navigate = useNavigate()
  const { accounts, activeAccountAddress } = useKeyringContext()

  const [isEditing, setIsEditing] = useState(!!documentId)
  const [loading, setLoading] = useState(!!documentId)
  const [saving, setSaving] = useState(false)

  // Formulario
  const [title, setTitle] = useState('')
  const [type, setType] = useState<DocumentType>('generic')
  const [content, setContent] = useState('')
  const [description, setDescription] = useState('')
  const [selectedAccount, setSelectedAccount] = useState<string>('')
  const [encrypt, setEncrypt] = useState(false)
  const [encryptPassword, setEncryptPassword] = useState('')
  const [encryptDialogOpen, setEncryptDialogOpen] = useState(false)

  useEffect(() => {
    if (documentId) {
      loadDocument()
    } else {
      // Si no hay documentId, usar la primera cuenta disponible
      if (accounts.length > 0) {
        setSelectedAccount(activeAccountAddress || accounts[0].address)
      }
    }
  }, [documentId, accounts, activeAccountAddress])

  const loadDocument = async () => {
    if (!documentId) return

    try {
      setLoading(true)
      const doc = await getDocument(documentId)

      if (!doc) {
        toast.error('Documento no encontrado')
        navigate('/documents')
        return
      }

      setTitle(doc.metadata.title || '')
      setType(doc.type)
      setDescription(doc.metadata.description || '')
      setSelectedAccount(doc.relatedAccount || activeAccountAddress || accounts[0]?.address || '')
      setContent('') // El contenido del PDF no se puede editar directamente
      setEncrypt(doc.encrypted || false)
    } catch (error) {
      console.error('[Document Editor] Error al cargar documento:', error)
      toast.error('Error al cargar el documento')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error('Por favor ingresa un título')
      return
    }

    if (!selectedAccount) {
      toast.error('Por favor selecciona una cuenta como autor')
      return
    }

    if (!content.trim()) {
      toast.error('Por favor ingresa contenido para el documento')
      return
    }

    try {
      setSaving(true)

      // Usar el HTML de Quill directamente - el generador de PDF lo procesará
      // Crear documento
      const document = await createDocument({
        type,
        metadata: {
          title,
          description,
          author: selectedAccount,
          createdAt: new Date().toISOString(),
        },
        pdfContent: {
          title,
          subtitle: description,
          sections: [
            {
              title: 'Contenido',
              content: content || '<p>Sin contenido</p>',
              isTable: false,
            },
          ],
        },
        relatedAccount: selectedAccount,
      })

      // Encriptar si se solicita
      let finalDocument = document
      if (encrypt) {
        if (!encryptPassword.trim()) {
          setEncryptDialogOpen(true)
          return
        }

        finalDocument = await encryptDocument(document, encryptPassword)
        toast.success('Documento encriptado y guardado')
      } else {
        toast.success('Documento guardado exitosamente')
      }

      // Navegar al detalle del documento
      navigate(`/documents/${finalDocument.documentId}`)
    } catch (error) {
      console.error('[Document Editor] Error al guardar:', error)
      toast.error(
        error instanceof Error ? error.message : 'Error al guardar el documento'
      )
    } finally {
      setSaving(false)
    }
  }

  const handleEncryptConfirm = async () => {
    if (!encryptPassword.trim()) {
      toast.error('Por favor ingresa una contraseña')
      return
    }

    setEncryptDialogOpen(false)
    await handleSave()
  }

  if (loading) {
    return (
      <div className="container mx-auto p-4">
        <div className="flex items-center justify-center min-h-[400px]">
          <p className="text-muted-foreground">Cargando documento...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-4 pb-6 sm:pb-8 space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/documents')}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">
            {isEditing ? 'Editar Documento' : 'Nuevo Documento'}
          </h1>
          <p className="text-muted-foreground">
            {isEditing
              ? 'Edita los metadatos del documento'
              : 'Crea un nuevo documento y genera el PDF'}
          </p>
        </div>
      </div>

      {/* Formulario */}
      <div className="space-y-6">
        {/* Metadata */}
        <Card>
          <CardHeader>
            <CardTitle>Información del Documento</CardTitle>
            <CardDescription>
              Configura los metadatos del documento
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="title">Título *</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Título del documento"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="type">Tipo de Documento</Label>
                <Select value={type} onValueChange={(v) => setType(v as DocumentType)}>
                  <SelectTrigger id="type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="generic">Genérico</SelectItem>
                    <SelectItem value="contract">Contrato</SelectItem>
                    <SelectItem value="flight_log">Registro de Vuelo</SelectItem>
                    <SelectItem value="medical_record">Registro Médico</SelectItem>
                    <SelectItem value="attestation">Atestación</SelectItem>
                    <SelectItem value="other">Otro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descripción</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descripción del documento"
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="account">Autor *</Label>
              <Select
                value={selectedAccount}
                onValueChange={setSelectedAccount}
              >
                <SelectTrigger id="account">
                  <SelectValue placeholder="Selecciona una cuenta">
                    {selectedAccount && (
                      <div className="flex items-center gap-2">
                        <Identicon
                          value={selectedAccount}
                          size={16}
                          theme="polkadot"
                        />
                        <span>
                          {accounts.find(a => a.address === selectedAccount)?.meta?.name || 
                           `${selectedAccount.slice(0, 8)}...${selectedAccount.slice(-6)}`}
                        </span>
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
            </div>
          </CardContent>
        </Card>

        {/* Contenido */}
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Contenido</CardTitle>
            <CardDescription>
              Escribe el contenido del documento
            </CardDescription>
          </CardHeader>
          <CardContent className="w-full p-4 sm:p-6">
            <div className="space-y-2 w-full">
              <Label>Contenido del Documento *</Label>
              <div className="w-full" style={{ minHeight: '350px' }}>
                <RichTextEditor
                  value={content}
                  onChange={setContent}
                  placeholder="Escribe el contenido del documento aquí..."
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Opciones de Seguridad */}
      <Card>
        <CardHeader>
          <CardTitle>Opciones de Seguridad</CardTitle>
          <CardDescription>
            Configura la seguridad del documento
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="encrypt"
              checked={encrypt}
              onChange={(e) => setEncrypt(e.target.checked)}
              className="rounded border-gray-300"
            />
            <Label htmlFor="encrypt" className="cursor-pointer">
              Encriptar documento con contraseña
            </Label>
          </div>
        </CardContent>
      </Card>

      {/* Acciones */}
      <div className="flex gap-4 justify-end">
        <Button
          variant="outline"
          onClick={() => navigate('/documents')}
        >
          Cancelar
        </Button>
        <Button
          onClick={handleSave}
          disabled={saving}
        >
          <Save className="mr-2 h-4 w-4" />
          {saving ? 'Guardando...' : 'Guardar Documento'}
        </Button>
      </div>

      {/* Dialog para contraseña de encriptación */}
      <Dialog open={encryptDialogOpen} onOpenChange={setEncryptDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Encriptar Documento</DialogTitle>
            <DialogDescription>
              Ingresa una contraseña para encriptar el documento. Esta contraseña será necesaria para desencriptarlo.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="encrypt-password">Contraseña *</Label>
              <Input
                id="encrypt-password"
                type="password"
                value={encryptPassword}
                onChange={(e) => setEncryptPassword(e.target.value)}
                placeholder="Contraseña de encriptación"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setEncryptDialogOpen(false)
                  setEncryptPassword('')
                }}
              >
                Cancelar
              </Button>
              <Button onClick={handleEncryptConfirm}>
                Confirmar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

