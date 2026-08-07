import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { X, Upload, AlertCircle, Trash2, Image as ImageIcon } from 'lucide-react'

export default function HeroSlideModal({ isOpen, onClose, slide, onSave }) {
  const [image, setImage] = useState('')
  const [active, setActive] = useState(true)

  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (isOpen) {
      if (slide) {
        setImage(slide.image || '')
        setActive(slide.active !== undefined ? slide.active : true)
      } else {
        setImage('')
        setActive(true)
      }
      setError(null)
    }
  }, [isOpen, slide])

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    setError(null)

    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = async () => {
      const base64Image = reader.result
      setImage(base64Image)

      try {
        const fileExt = file.name.split('.').pop()
        const fileName = `hero_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${fileExt}`
        const filePath = `banners/${fileName}`

        const { error: uploadError } = await supabase.storage
          .from('product-images')
          .upload(filePath, file, { upsert: true })

        if (!uploadError) {
          const { data: { publicUrl } } = supabase.storage
            .from('product-images')
            .getPublicUrl(filePath)

          if (publicUrl) setImage(publicUrl)
        }
      } catch (err) {
        console.log('Mantendo imagem Base64 do computador:', err)
      } finally {
        setUploading(false)
      }
    }

    reader.onerror = () => {
      setError('Erro ao ler o arquivo de imagem do seu computador.')
      setUploading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)

    if (!image.trim()) {
      setError('Por favor, envie uma imagem do seu computador para o banner.')
      return
    }

    setSaving(true)

    try {
      const payload = {
        title: 'Banner Hero',
        image: image.trim(),
        active,
        updated_at: new Date().toISOString()
      }

      if (slide) {
        const { error: updateError } = await supabase
          .from('hero_slides')
          .update(payload)
          .eq('id', slide.id)

        if (updateError) throw updateError
      } else {
        const { data: lastSlide } = await supabase
          .from('hero_slides')
          .select('display_order')
          .order('display_order', { ascending: false })
          .limit(1)

        const nextOrder = lastSlide && lastSlide.length > 0 ? lastSlide[0].display_order + 1 : 0

        const newSlideId = 'slide-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6)
        const { error: insertError } = await supabase
          .from('hero_slides')
          .insert([{ id: newSlideId, ...payload, display_order: nextOrder }])

        if (insertError) throw insertError
      }


      onSave()
      onClose()
    } catch (err) {
      setError('Erro ao salvar banner: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col relative my-auto">
        {/* Header Modal */}
        <div className="p-5 px-6 border-b border-slate-800 flex items-center justify-between shrink-0 bg-slate-900">
          <h3 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
            <ImageIcon className="w-5 h-5 text-indigo-400" />
            {slide ? 'Editar Imagem do Banner' : 'Adicionar Novo Banner'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-rose-600 text-slate-400 hover:text-white flex items-center justify-center transition-all cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body - Exclusivo para Upload de Arquivo do Computador */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-sm flex items-center gap-3">
              <AlertCircle className="w-5 h-5 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {/* Área de Seleção de Arquivo do Computador */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Enviar Arquivo de Imagem do Computador <span className="text-rose-400">*</span>
            </label>

            <div className="space-y-3">
              {image ? (
                <div className="relative aspect-video rounded-xl bg-slate-950 border border-slate-800 overflow-hidden group">
                  <img src={image} alt="Banner Preview" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setImage('')}
                    className="absolute top-2 right-2 p-2 bg-rose-600 text-white rounded-lg opacity-90 hover:opacity-100 shadow-lg cursor-pointer flex items-center gap-1 text-xs font-semibold"
                    title="Remover e Enviar Outra Foto"
                  >
                    <Trash2 className="w-4 h-4" /> Trocar Foto
                  </button>
                </div>
              ) : (
                <label className={`aspect-video rounded-xl border-2 border-dashed border-slate-800 hover:border-indigo-500 bg-slate-950/60 flex flex-col items-center justify-center cursor-pointer transition-colors ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
                  <Upload className="w-10 h-10 text-indigo-400 mb-2 animate-bounce" />
                  <span className="text-sm text-slate-100 font-bold">
                    {uploading ? 'Carregando arquivo...' : 'Escolher Foto do Computador'}
                  </span>
                  <span className="text-xs text-slate-400 mt-1">
                    Clique aqui para selecionar o arquivo no seu PC
                  </span>
                  <span className="text-[11px] text-slate-500 mt-1 font-mono">Suporta PNG, JPG, JPEG, WEBP</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </label>
              )}
            </div>
          </div>

          {/* Checkbox Ativo */}
          <div className="flex items-center gap-3 p-3.5 bg-slate-950/60 border border-slate-800 rounded-xl">
            <input
              type="checkbox"
              id="activeSlideCheckbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              className="w-4 h-4 rounded bg-slate-900 border-slate-700 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
            />
            <label htmlFor="activeSlideCheckbox" className="text-xs font-semibold text-slate-200 cursor-pointer">
              Slide Ativo (Visível na vitrine)
            </label>
          </div>

          {/* Botões do Modal */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 text-sm font-medium transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving || !image}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm shadow-lg shadow-indigo-600/20 transition-all disabled:opacity-50 cursor-pointer"
            >
              {saving ? 'Salvando...' : 'Salvar Banner'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
