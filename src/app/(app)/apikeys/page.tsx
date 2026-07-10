"use client"

import { useEffect, useState } from "react"
import { api } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Label } from "@/components/ui/label"

interface ApiKeyItem {
  id: string
  name: string
  key?: string
  created_at: string
}

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKeyItem[]>([])
  const [name, setName] = useState("")
  const [newKey, setNewKey] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const load = async () => {
    const data = await api.listApiKeys()
    setKeys(data)
  }

  useEffect(() => {
    let cancelled = false
    void api.listApiKeys().then((data) => {
      if (!cancelled) setKeys(data)
    })
    return () => { cancelled = true }
  }, [])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    const result = await api.createApiKey(name)
    setNewKey(result.key)
    setName("")
    load()
  }

  const handleDelete = async () => {
    if (!deleteId) return
    await api.deleteApiKey(deleteId)
    setDeleteId(null)
    load()
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold">API Keys</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Create New Key</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="flex gap-2">
            <div className="flex-1">
              <Label htmlFor="keyname" className="sr-only">Key Name</Label>
              <Input
                id="keyname"
                placeholder="Key name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <Button type="submit">Create</Button>
          </form>
          {newKey && (
            <div className="mt-4 p-3 rounded-md bg-muted text-sm break-all">
              <p className="text-muted-foreground mb-1">Copy this key now — it won&apos;t be shown again:</p>
              <code className="font-mono">{newKey}</code>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="space-y-2">
        {keys.map((k) => (
          <Card key={k.id}>
            <CardContent className="flex items-center justify-between py-4">
              <div>
                <p className="font-medium">{k.name}</p>
                <p className="text-xs text-muted-foreground">
                  Created: {new Date(k.created_at).toLocaleDateString()}
                </p>
              </div>
              <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setDeleteId(k.id)}>
                Delete
              </Button>
            </CardContent>
          </Card>
        ))}
        {keys.length === 0 && (
          <p className="text-muted-foreground text-sm text-center py-8">No API keys yet.</p>
        )}
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete API Key?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
