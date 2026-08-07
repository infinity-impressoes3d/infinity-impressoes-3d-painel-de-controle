import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { X, Star, AlertCircle, Upload, Link as LinkIcon, Image as ImageIcon, Package, Check, Trash2 } from 'lucide-react'

export default function CollectionModal({ isOpen, onClose, collection, onSave }) {
  const [name, setName] = useState('')
  const [image, setImage] = useState('')
  const [imageUrlInput, setImageUrlInput] = useState('')
  const [isFeaturedHome, setIsFeaturedHome] = useState(false)

  // Lista de todos os produtos do banco e IDs dos produtos selecionados para esta coleção
  const [allProducts, setAllProducts] = useState([])
  const [selectedProductIds, setSelectedProductIds] = useState([])

  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (isOpen) {
      fetchProductsAndRelations()
      if (collection) {
        setName(collection.name || '')
        setImage(collection.image || '')
        setIsFeaturedHome(collection.is_featured_home || false)
      } else {
        setName('')
        setImage('')
        setIsFeaturedHome(false)
      }
      setImageUrlInput('')
      setError(null)
    }
  }, [isOpen, collection])

  const fetchProductsAndRelations = async () => {
    try {
      // 1. Busca todos os produtos ativos do banco
      const { data: prods } = await supabase
        .from('products')
        .select('id, name, price, images, active, collection_id')
        .order('name')

      setAllProducts(prods || [])

      // 2. Se for edição, identifica os produtos que pertencem a ela
      if (collection?.id) {
        // Busca da tabela N:N (product_collections)
        const { data: rels } = await supabase
          .from('product_collections')
          .select('product_id')
          .eq('collection_id', collection.id)

        const relIds = rels ? rels.map(r => r.product_id) : []

        // Busca também da coluna collection_id dos produtos
        const directIds = (prods || [])
          .filter(p => p.collection_id === collection.id)
          .map(p => p.id)

        const combinedIds = Array.from(new Set([...relIds, ...directIds]))
        setSelectedProductIds(combinedIds)
      } else {
        setSelectedProductIds([])
      }
    } catch (err) {
      console.error('Erro ao buscar produtos para coleção:', err)
    }
  }

  // Upload de imagem da coleção
  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    setError(null)

    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `collection_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${fileExt}`
      const filePath = `collections/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(filePath, file, { upsert: true })

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('product-images')
        .getPublicUrl(filePath)

      setImage(publicUrl)
    } catch (err) {
      // Fallback base64
      try {
        const reader = new FileReader()
        reader.readAsDataURL(file)
        reader.onload = () => setImage(reader.result)
      } catch (e) {
        setError('Erro ao enviar imagem da coleção: ' + err.message)
      }
    } finally {
      setUploading(false)
    }
  }

  const handleAddUrlImage = () => {
    const url = imageUrlInput.trim()
    if (!url) return
    setImage(url)
    setImageUrlInput('')
  }

  const handleToggleProduct = (productId) => {
    if (selectedProductIds.includes(productId)) {
      setSelectedProductIds(selectedProductIds.filter(id => id !== productId))
    } else {
      setSelectedProductIds([...selectedProductIds, productId])
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)

    if (!name.trim()) {
      setError('O nome da coleção é obrigatório.')
      return
    }

    setSaving(true)

    try {
      let targetCollectionId = collection?.id

      if (collection) {
        // Atualiza coleção existente
        const { error: updateError } = await supabase
          .from('collections')
          .update({
            name: name.trim(),
            image: image || null,
            is_featured_home: isFeaturedHome,
          })
          .eq('id', collection.id)

        if (updateError) throw updateError
      } else {
        // Cria nova coleção
        const { data: lastCol } = await supabase
          .from('collections')
          .select('display_order')
          .order('display_order', { ascending: false })
          .limit(1)

        const nextOrder = lastCol && lastCol.length > 0 ? lastCol[0].display_order + 1 : 0

        const generatedColId = 'col-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6)
        const { data: newCol, error: insertError } = await supabase
          .from('collections')
          .insert([
            {
              id: generatedColId,
              name: name.trim(),
              image: image || null,
              display_order: nextOrder,
              is_featured_home: isFeaturedHome,
            },
          ])
          .select()
          .single()

        if (insertError) throw insertError

        targetCollectionId = newCol.id
      }

      // Salva os produtos vinculados na tabela N:N (product_collections)
      if (targetCollectionId) {
        // 1. Remove vínculos anteriores dessa coleção
        await supabase
          .from('product_collections')
          .delete()
          .eq('collection_id', targetCollectionId)

        // 2. Insere novos vínculos selecionados
        if (selectedProductIds.length > 0) {
          const insertPayload = selectedProductIds.map(pId => ({
            product_id: pId,
            collection_id: targetCollectionId
          }))

          const { error: relError } = await supabase
            .from('product_collections')
            .insert(insertPayload)

          if (relError) console.error('Erro ao salvar produtos da coleção:', relError.message)
        }
      }

      onSave()
      onClose()
    } catch (err) {
      setError('Erro ao salvar coleção: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl max-h-[90vh] flex flex-col relative my-auto">
        {/* Header Modal */}
        <div className="p-5 px-6 border-b border-slate-800 flex items-center justify-between shrink-0 bg-slate-900">
          <h3 className="text-lg font-bold text-white tracking-tight">
            {collection ? 'Editar Coleção' : 'Nova Coleção'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-rose-600 text-slate-400 hover:text-white flex items-center justify-center transition-all cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto flex-1">
          {error && (
            <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-sm flex items-center gap-3">
              <AlertCircle className="w-5 h-5 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {/* Nome da Coleção */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Nome da Coleção <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Figures & Animes, Decoração 3D, Setup Gamer"
              className="w-full bg-slate-950 border border-slate-800 focus:border-purple-500 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none"
            />
          </div>

          {/* Imagem / Banner da Coleção */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Imagem / Banner da Coleção (Para a Home da Vitrine)
            </label>
            
            <div className="space-y-3">
              {image ? (
                <div className="relative h-32 rounded-xl bg-slate-950 border border-slate-800 overflow-hidden group">
                  <img src={image} alt="Banner Coleção" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setImage('')}
                    className="absolute top-2 right-2 p-1.5 bg-rose-600 text-white rounded-lg opacity-90 hover:opacity-100 shadow-lg"
                    title="Remover Imagem"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <label className={`flex-1 h-24 rounded-xl border-2 border-dashed border-slate-800 hover:border-purple-500 bg-slate-950/60 flex flex-col items-center justify-center cursor-pointer transition-colors ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
                    <Upload className="w-5 h-5 text-purple-400 mb-1" />
                    <span className="text-xs text-slate-400 font-medium">
                      {uploading ? 'Enviando imagem...' : 'Enviar Foto / Banner da Coleção'}
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              )}

              {/* Adicionar por URL */}
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                    <LinkIcon className="w-4 h-4" />
                  </div>
                  <input
                    type="url"
                    value={imageUrlInput}
                    onChange={(e) => setImageUrlInput(e.target.value)}
                    placeholder="Ou cole o link direto da imagem (http://...)"
                    className="w-full bg-slate-950 border border-slate-800 focus:border-purple-500 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleAddUrlImage}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl transition-colors"
                >
                  + Link URL
                </button>
              </div>
            </div>
          </div>

          {/* Destaque na Home */}
          <div className="flex items-center gap-3 p-4 bg-slate-950/60 border border-slate-800 rounded-xl">
            <input
              type="checkbox"
              id="featuredCheckbox"
              checked={isFeaturedHome}
              onChange={(e) => setIsFeaturedHome(e.target.checked)}
              className="w-4 h-4 rounded bg-slate-900 border-slate-700 text-purple-600 focus:ring-purple-500 cursor-pointer"
            />
            <label htmlFor="featuredCheckbox" className="text-sm font-medium text-slate-200 cursor-pointer flex items-center gap-1.5">
              <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
              Mostrar em Destaque na Home da Vitrine ⭐
            </label>
          </div>

          {/* Seleção de Produtos para a Coleção (Multiseleção N:N) */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Package className="w-4 h-4 text-purple-400" /> Selecionar Produtos Desta Coleção
              </span>
              <span className="text-purple-400 text-[11px] font-normal">
                {selectedProductIds.length} {selectedProductIds.length === 1 ? 'produto selecionado' : 'produtos selecionados'}
              </span>
            </label>
            <p className="text-[11px] text-slate-500 mb-3">
              Marque os produtos que fazem parte desta coleção. Cada produto pode pertencer a mais de uma coleção!
            </p>

            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 max-h-56 overflow-y-auto space-y-2">
              {allProducts.length === 0 ? (
                <div className="text-center text-xs text-slate-500 py-4">
                  Nenhum produto cadastrado no banco de dados.
                </div>
              ) : (
                allProducts.map((p) => {
                  const isSelected = selectedProductIds.includes(p.id)
                  const img = p.images && p.images[0] ? p.images[0] : 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80'

                  return (
                    <div
                      key={p.id}
                      onClick={() => handleToggleProduct(p.id)}
                      className={`p-2.5 rounded-lg border transition-all flex items-center justify-between cursor-pointer ${
                        isSelected
                          ? 'bg-purple-950/40 border-purple-500/50 text-white'
                          : 'bg-slate-900/50 border-slate-800/80 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <img 
                          src={img} 
                          alt={p.name} 
                          onError={(e) => {
                            e.target.onerror = null
                            e.target.src = 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80'
                          }}
                          className="w-9 h-9 rounded-md object-cover bg-slate-950 shrink-0" 
                        />
                        <div>
                          <div className="text-xs font-medium text-slate-200">{p.name}</div>
                          <div className="text-[10px] text-slate-500">R$ {Number(p.price).toFixed(2).replace('.', ',')}</div>
                        </div>
                      </div>

                      <div className={`w-5 h-5 rounded flex items-center justify-center border transition-all ${
                        isSelected ? 'bg-purple-600 border-purple-500 text-white' : 'border-slate-700 bg-slate-950'
                      }`}>
                        {isSelected && <Check className="w-3.5 h-3.5" />}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 text-sm font-medium transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-sm shadow-lg shadow-purple-600/20 transition-all disabled:opacity-50"
            >
              {saving ? 'Salvando...' : 'Salvar Coleção'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
