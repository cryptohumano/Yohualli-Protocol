import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Plus, Edit, Trash2, Save, ExternalLink, Key, Globe, Shield } from 'lucide-react'
import { WebAuthnCredentialsManager } from '@/components/WebAuthnCredentialsManager'
import { DatabaseManager } from '@/components/DatabaseManager'
import { BackupManager } from '@/components/BackupManager'
import { useTranslation } from 'react-i18next'

interface ApiConfig {
  id: string
  name: string
  baseUrl: string
  apiKey?: string
  description?: string
  type: 'credential' | 'medical' | 'attestation' | 'other'
  enabled: boolean
  createdAt: number
  updatedAt: number
}

// Simulación de almacenamiento (temporal, hasta que se implemente la DB completa)
const API_CONFIGS_STORAGE_KEY = 'aura-wallet-api-configs'

function useApiConfigsStorage() {
  const [configs, setConfigs] = useState<ApiConfig[]>([])

  useEffect(() => {
    const stored = localStorage.getItem(API_CONFIGS_STORAGE_KEY)
    if (stored) {
      try {
        setConfigs(JSON.parse(stored))
      } catch (e) {
        console.error('Error loading API configs:', e)
      }
    }
  }, [])

  const saveConfigs = (newConfigs: ApiConfig[]) => {
    setConfigs(newConfigs)
    localStorage.setItem(API_CONFIGS_STORAGE_KEY, JSON.stringify(newConfigs))
  }

  const addConfig = (config: Omit<ApiConfig, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newConfig: ApiConfig = {
      ...config,
      id: `api-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    const updated = [...configs, newConfig]
    saveConfigs(updated)
    return newConfig
  }

  const updateConfig = (id: string, updates: Partial<ApiConfig>) => {
    const updated = configs.map(c =>
      c.id === id ? { ...c, ...updates, updatedAt: Date.now() } : c
    )
    saveConfigs(updated)
  }

  const deleteConfig = (id: string) => {
    const updated = configs.filter(c => c.id !== id)
    saveConfigs(updated)
  }

  return {
    configs,
    addConfig,
    updateConfig,
    deleteConfig,
  }
}

export default function Settings() {
  const { t } = useTranslation('pages')
  const { i18n } = useTranslation()
  const { configs, addConfig, updateConfig, deleteConfig } = useApiConfigsStorage()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingConfig, setEditingConfig] = useState<ApiConfig | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    baseUrl: '',
    apiKey: '',
    description: '',
    type: 'credential' as ApiConfig['type'],
    enabled: true,
  })

  const handleOpenDialog = (config?: ApiConfig) => {
    if (config) {
      setEditingConfig(config)
      setFormData({
        name: config.name,
        baseUrl: config.baseUrl,
        apiKey: config.apiKey || '',
        description: config.description || '',
        type: config.type,
        enabled: config.enabled,
      })
    } else {
      setEditingConfig(null)
      setFormData({
        name: '',
        baseUrl: '',
        apiKey: '',
        description: '',
        type: 'credential',
        enabled: true,
      })
    }
    setIsDialogOpen(true)
  }

  const handleCloseDialog = () => {
    setIsDialogOpen(false)
    setEditingConfig(null)
    setFormData({
      name: '',
      baseUrl: '',
      apiKey: '',
      description: '',
      type: 'credential',
      enabled: true,
    })
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.name.trim() || !formData.baseUrl.trim()) {
      return
    }

    if (editingConfig) {
      updateConfig(editingConfig.id, {
        name: formData.name.trim(),
        baseUrl: formData.baseUrl.trim(),
        apiKey: formData.apiKey.trim() || undefined,
        description: formData.description.trim() || undefined,
        type: formData.type,
        enabled: formData.enabled,
      })
    } else {
      addConfig({
        name: formData.name.trim(),
        baseUrl: formData.baseUrl.trim(),
        apiKey: formData.apiKey.trim() || undefined,
        description: formData.description.trim() || undefined,
        type: formData.type,
        enabled: formData.enabled,
      })
    }

    handleCloseDialog()
  }

  const getTypeLabel = (type: ApiConfig['type']) => {
    const labels: Record<ApiConfig['type'], string> = {
      credential: t('settings.typeCred'),
      medical: t('settings.typeMedical'),
      attestation: t('settings.typeAttest'),
      other: t('settings.typeOther'),
    }
    return labels[type]
  }

  const getTypeIcon = (type: ApiConfig['type']) => {
    switch (type) {
      case 'credential':
        return <Key className="h-4 w-4" />
      case 'medical':
        return <Shield className="h-4 w-4" />
      case 'attestation':
        return <Globe className="h-4 w-4" />
      default:
        return <ExternalLink className="h-4 w-4" />
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{t('settings.title')}</h1>
        <p className="text-muted-foreground mt-2">
          {t('settings.subtitle')}
        </p>
      </div>

      <Tabs defaultValue="apis" className="space-y-4">
        <TabsList>
          <TabsTrigger value="apis">{t('settings.tabApis')}</TabsTrigger>
          <TabsTrigger value="general">{t('settings.tabGeneral')}</TabsTrigger>
          <TabsTrigger value="security">{t('settings.tabSecurity')}</TabsTrigger>
        </TabsList>

        {/* APIs Externas */}
        <TabsContent value="apis" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>{t('settings.apisTitle')}</CardTitle>
                  <CardDescription>
                    {t('settings.apisDesc')}
                  </CardDescription>
                </div>
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                  <DialogTrigger asChild>
                    <Button onClick={() => handleOpenDialog()}>
                      <Plus className="mr-2 h-4 w-4" />
                      {t('settings.addApi')}
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl max-h-[90vh] sm:max-h-[85vh] overflow-y-auto mx-4 sm:mx-0">
                    <DialogHeader>
                      <DialogTitle>
                        {editingConfig ? t('settings.dialogEdit') : t('settings.dialogNew')}
                      </DialogTitle>
                      <DialogDescription>
                        {editingConfig
                          ? t('settings.dialogEditDesc')
                          : t('settings.dialogNewDesc')}
                      </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="name">{t('settings.nameReq')}</Label>
                        <Input
                          id="name"
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          placeholder={t('settings.namePh')}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="baseUrl">{t('settings.urlReq')}</Label>
                        <Input
                          id="baseUrl"
                          type="url"
                          value={formData.baseUrl}
                          onChange={(e) => setFormData({ ...formData, baseUrl: e.target.value })}
                          placeholder="https://api.example.com"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="apiKey">{t('settings.apiKey')}</Label>
                        <Input
                          id="apiKey"
                          type="password"
                          value={formData.apiKey}
                          onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                          placeholder={t('settings.apiKeyPh')}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="type">{t('settings.typeReq')}</Label>
                        <select
                          id="type"
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                          value={formData.type}
                          onChange={(e) => setFormData({ ...formData, type: e.target.value as ApiConfig['type'] })}
                          required
                        >
                          <option value="credential">{t('settings.typeCred')}</option>
                          <option value="medical">{t('settings.typeMedical')}</option>
                          <option value="attestation">{t('settings.typeAttest')}</option>
                          <option value="other">{t('settings.typeOther')}</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="description">{t('settings.description')}</Label>
                        <Input
                          id="description"
                          value={formData.description}
                          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                          placeholder={t('settings.descriptionPh')}
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="enabled"
                          checked={formData.enabled}
                          onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                          className="rounded border-gray-300"
                        />
                        <Label htmlFor="enabled" className="cursor-pointer">
                          {t('settings.enabled')}
                        </Label>
                      </div>
                      <div className="flex gap-2 justify-end">
                        <Button type="button" variant="outline" onClick={handleCloseDialog}>
                          {t('settings.cancel')}
                        </Button>
                        <Button type="submit">
                          <Save className="mr-2 h-4 w-4" />
                          {editingConfig ? t('settings.save') : t('settings.add')}
                        </Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {configs.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <p className="mb-4">{t('settings.emptyApis')}</p>
                  <Button onClick={() => handleOpenDialog()}>
                    <Plus className="mr-2 h-4 w-4" />
                    {t('settings.addFirst')}
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {configs.map((config) => (
                    <div
                      key={config.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          {getTypeIcon(config.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold truncate">{config.name}</h3>
                            <Badge variant={config.enabled ? 'default' : 'secondary'}>
                              {config.enabled ? t('settings.statusOn') : t('settings.statusOff')}
                            </Badge>
                            <Badge variant="outline">{getTypeLabel(config.type)}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground truncate">
                            {config.baseUrl}
                          </p>
                          {config.description && (
                            <p className="text-xs text-muted-foreground mt-1 truncate">
                              {config.description}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenDialog(config)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            if (confirm(t('settings.confirmDelete'))) {
                              deleteConfig(config.id)
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Alert>
            <Shield className="h-4 w-4" />
            <AlertDescription>
              {t('settings.securityApi')}
            </AlertDescription>
          </Alert>
        </TabsContent>

        {/* General */}
        <TabsContent value="general" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('settings.genTitle')}</CardTitle>
              <CardDescription>
                {t('settings.genDesc')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>{t('settings.labelLang')}</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={i18n.resolvedLanguage === 'en' || i18n.resolvedLanguage === 'es' ? i18n.resolvedLanguage : 'es'}
                  onChange={(e) => void i18n.changeLanguage(e.target.value)}
                >
                  <option value="es">Español</option>
                  <option value="en">English</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>{t('settings.labelCurrency')}</Label>
                <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="DOT">DOT</option>
                </select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Seguridad */}
        <TabsContent value="security" className="space-y-4">
          <WebAuthnCredentialsManager />

          <Card data-section="backup">
            <CardHeader>
              <CardTitle>{t('settings.backupTitle')}</CardTitle>
              <CardDescription>
                {t('settings.backupDesc')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <BackupManager />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('settings.dataTitle')}</CardTitle>
              <CardDescription>
                {t('settings.dataDesc')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <DatabaseManager />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
