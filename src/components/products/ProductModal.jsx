import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { X, Upload, Trash2, Plus, Tag, Weight, DollarSign, Image as ImageIcon, AlertCircle, Heading1, Heading2, Bold, Italic, List, Link, Truck } from 'lucide-react'

export default function ProductModal({ isOpen, onClose, product, onSave }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')
  const [oldPrice, setOldPrice] = useState('')
  const [weightGrams, setWeightGrams] = useState('')
  const [sizesInput, setSizesInput] = useState('')
  const [collectionId, setCollectionId] = useState('')
  const [active, setActive] = useState(true)
  const [isFreeShipping, setIsFreeShipping] = useState(false)
  const [images, setImages] = useState([])
  const [imageUrlInput, setImageUrlInput] = useState('')

  const [collections, setCollections] = useState([])
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const textareaRef = useRef(null)

  useEffect(() => {
    if (isOpen) {
      fetchCollections()
      if (product) {
        // Preenche formulário com dados de edição
        setName(product.name || '')
        setDescription(product.description || '')
        setPrice(product.price !== undefined && product.price !== null ? formatCurrencyValue(product.price) : '')
        setOldPrice(product.old_price !== undefined && product.old_price !== null ? formatCurrencyValue(product.old_price) : product.oldPrice ? formatCurrencyValue(product.oldPrice) : '')
        setWeightGrams(product.weight_grams ? product.weight_grams.toString() : '')
        setSizesInput(product.sizes ? product.sizes.join(', ') : '')
        setCollectionId(product.collection_id || '')
        setActive(product.active !== undefined ? product.active : true)
        setIsFreeShipping(Boolean(product.is_free_shipping || product.free_shipping))
        setImages(product.images || [])
      } else {
        // Reset formulário para novo produto
        setName('')
        setDescription('')
        setPrice('')
        setOldPrice('')
        setWeightGrams('')
        setSizesInput('')
        setCollectionId('')
        setActive(true)
        setIsFreeShipping(false)
        setImages([])
      }
      setImageUrlInput('')
      setError(null)
    }
  }, [isOpen, product])

  const fetchCollections = async () => {
    const { data } = await supabase.from('collections').select('id, name').order('name')
    setCollections(data || [])
  }

  // Format currency value to 2 decimal places (e.g., 10 -> "10.00")
  function formatCurrencyValue(val) {
    if (val === undefined || val === null || val === '') return ''
    const num = parseFloat(val.toString().replace(',', '.'))
    if (isNaN(num)) return ''
    return num.toFixed(2)
  }

  // Handle onBlur for Price Inputs
  const handlePriceBlur = (val, setFn) => {
    if (!val) return
    const formatted = formatCurrencyValue(val)
    if (formatted) setFn(formatted)
  }

  // Quick formatting insertion for Description Markdown
  const insertFormatting = (prefix, suffix = '') => {
    const textarea = textareaRef.current
    if (!textarea) {
      setDescription(prev => prev + prefix + suffix)
      return
    }

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const selected = description.substring(start, end) || 'Texto'
    const replacement = `${prefix}${selected}${suffix}`

    const newText = description.substring(0, start) + replacement + description.substring(end)
    setDescription(newText)

    setTimeout(() => {
      textarea.focus()
      textarea.setSelectionRange(start + prefix.length, start + prefix.length + selected.length)
    }, 50)
  }

  // Helper to convert file to Base64
  const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.readAsDataURL(file)
      reader.onload = () => resolve(reader.result)
      reader.onerror = (err) => reject(err)
    })
  }

  // Handles multiple image uploads to Supabase Storage with Base64 fallback
  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return

    setUploading(true)
    setError(null)

    const uploadedUrls = []

    try {
      for (const file of files) {
        try {
          const fileExt = file.name.split('.').pop()
          const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${fileExt}`
          const filePath = `products/${fileName}`

          const { error: uploadError } = await supabase.storage
            .from('product-images')
            .upload(filePath, file, { upsert: true })

          if (uploadError) throw uploadError

          const { data: { publicUrl } } = supabase.storage
            .from('product-images')
            .getPublicUrl(filePath)

          uploadedUrls.push(publicUrl)
        } catch (storageErr) {
          console.warn('Fallback para Base64 devido a falha no Storage:', storageErr.message)
          const base64Url = await fileToBase64(file)
          uploadedUrls.push(base64Url)
        }
      }

      setImages((prev) => [...prev, ...uploadedUrls])
    } catch (err) {
      setError('Erro ao enviar imagem: ' + err.message)
    } finally {
      setUploading(false)
    }
  }

  // Add Image by Direct URL
  const handleAddUrlImage = () => {
    const url = imageUrlInput.trim()
    if (!url) return
    setImages((prev) => [...prev, url])
    setImageUrlInput('')
  }

  const handleRemoveImage = (indexToRemove) => {
    setImages(images.filter((_, idx) => idx !== indexToRemove))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)

    if (!name.trim()) {
      setError('O nome do produto é obrigatório.')
      return
    }
    if (!description.trim()) {
      setError('A descrição do produto é obrigatória.')
      return
    }

    const parsedPrice = parseFloat(price.replace(',', '.'))
    if (isNaN(parsedPrice) || parsedPrice <= 0) {
      setError('Informe um preço de venda válido maior que zero.')
      return
    }

    const parsedOldPrice = oldPrice ? parseFloat(oldPrice.replace(',', '.')) : null

    if (images.length === 0) {
      setError('Adicione pelo menos 1 imagem do produto.')
      return
    }

    setSaving(true)

    try {
      const sizesArray = sizesInput
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0)

      const payload = {
        name: name.trim(),
        description: description.trim(),
        price: parsedPrice,
        old_price: parsedOldPrice,
        weight_grams: weightGrams ? parseFloat(weightGrams) : null,
        sizes: sizesArray,
        collection_id: collectionId || null,
        active,
        is_free_shipping: isFreeShipping,
        images,
        updated_at: new Date().toISOString(),
      }

      let savedProductId = product ? product.id : null

      let saveError = null
      if (product) {
        const { error: updateError } = await supabase
          .from('products')
          .update(payload)
          .eq('id', product.id)
        saveError = updateError
      } else {
        const newId = 'prod-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7)
        payload.id = newId
        savedProductId = newId

        const { error: insertError } = await supabase
          .from('products')
          .insert([payload])
        saveError = insertError
      }

      // Se uma coluna (ex: is_free_shipping) ainda não existir na tabela do Supabase remoto, tenta salvar sem a coluna
      if (saveError && saveError.message && saveError.message.includes('schema cache')) {
        const match = saveError.message.match(/Could not find the '([^']+)' column/)
        const missingCol = match && match[1] ? match[1] : 'is_free_shipping'
        if (Object.prototype.hasOwnProperty.call(payload, missingCol)) {
          const fallbackPayload = { ...payload }
          delete fallbackPayload[missingCol]

          if (product) {
            const { error: retryUpdateError } = await supabase
              .from('products')
              .update(fallbackPayload)
              .eq('id', product.id)
            saveError = retryUpdateError
          } else {
            const { error: retryInsertError } = await supabase
              .from('products')
              .insert([fallbackPayload])
            saveError = retryInsertError
          }
        }
      }

      if (saveError) throw saveError

      // Sincroniza relação na tabela product_collections se houver coleção
      if (savedProductId && collectionId) {
        await supabase
          .from('product_collections')
          .upsert([{ product_id: savedProductId, collection_id: collectionId }], { onConflict: 'product_id,collection_id' })
      }

      onSave()
      onClose()
    } catch (err) {
      setError('Erro ao salvar produto: ' + err.message)
    } finally {
      setSaving(false)
    }

  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl max-h-[90vh] flex flex-col relative my-auto">
        {/* Header Modal with Close X Button - Fixed at top */}
        <div className="p-5 px-6 border-b border-slate-800 flex items-center justify-between shrink-0 bg-slate-900 z-10">
          <h3 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
            <Tag className="w-5 h-5 text-indigo-400" />
            {product ? 'Editar Produto' : 'Novo Produto'}
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

        {/* Form Body - Internal Smooth Scroll */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto flex-1">
          {error && (
            <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-sm flex items-center gap-3">
              <AlertCircle className="w-5 h-5 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {/* Nome e Coleção */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Nome do Produto <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Action Figure Pernalonga 50cm"
                className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Coleção
              </label>
              <select
                value={collectionId}
                onChange={(e) => setCollectionId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-sm text-slate-100 focus:outline-none"
              >
                <option value="">Sem coleção atribuída</option>
                {collections.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Descrição com Rich Text Format Toolbar */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Descrição Detalhada <span className="text-rose-400">*</span>
              </label>
              
              {/* Rich Text Toolbar Buttons */}
              <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-lg p-1">
                <button
                  type="button"
                  title="Título Grande (#)"
                  onClick={() => insertFormatting('# ')}
                  className="p-1 px-2 text-xs font-bold text-slate-300 hover:text-indigo-400 hover:bg-slate-800 rounded flex items-center gap-1"
                >
                  <Heading1 className="w-3.5 h-3.5" /> H1
                </button>
                <button
                  type="button"
                  title="Subtítulo (##)"
                  onClick={() => insertFormatting('## ')}
                  className="p-1 px-2 text-xs font-bold text-slate-300 hover:text-indigo-400 hover:bg-slate-800 rounded flex items-center gap-1"
                >
                  <Heading2 className="w-3.5 h-3.5" /> H2
                </button>
                <button
                  type="button"
                  title="Negrito (**texto**)"
                  onClick={() => insertFormatting('**', '**')}
                  className="p-1 px-2 text-xs font-bold text-slate-300 hover:text-indigo-400 hover:bg-slate-800 rounded flex items-center gap-1"
                >
                  <Bold className="w-3.5 h-3.5" /> Negrito
                </button>
                <button
                  type="button"
                  title="Itálico (*texto*)"
                  onClick={() => insertFormatting('*', '*')}
                  className="p-1 px-2 text-xs font-bold text-slate-300 hover:text-indigo-400 hover:bg-slate-800 rounded flex items-center gap-1"
                >
                  <Italic className="w-3.5 h-3.5" /> Itálico
                </button>
                <button
                  type="button"
                  title="Lista (- item)"
                  onClick={() => insertFormatting('\n- ')}
                  className="p-1 px-2 text-xs font-bold text-slate-300 hover:text-indigo-400 hover:bg-slate-800 rounded flex items-center gap-1"
                >
                  <List className="w-3.5 h-3.5" /> Lista
                </button>
              </div>
            </div>

            <textarea
              ref={textareaRef}
              required
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Use # Título, **negrito**, *itálico* e - listas para formatar a descrição..."
              className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl p-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none font-mono"
            />
          </div>

          {/* Preços: Preço Atual (Por) e Preço Antigo (De) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Preço de Venda / Por (R$) <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500 text-sm font-semibold">
                  R$
                </div>
                <input
                  type="text"
                  required
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  onBlur={(e) => handlePriceBlur(e.target.value, setPrice)}
                  placeholder="349.90"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none"
                />
              </div>
              <span className="text-[10px] text-slate-500 mt-1 block">
                Valor normal com 2 casas decimais (ex: 349,90 vira 349.90).
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Preço Antigo / De (R$) <span className="text-slate-500 font-normal">(Riscado)</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500 text-sm font-semibold">
                  R$
                </div>
                <input
                  type="text"
                  value={oldPrice}
                  onChange={(e) => setOldPrice(e.target.value)}
                  onBlur={(e) => handlePriceBlur(e.target.value, setOldPrice)}
                  placeholder="420.00"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none"
                />
              </div>
              <span className="text-[10px] text-slate-500 mt-1 block">
                Aparecerá cortado (ex: <span className="line-through">De R$ 420,00</span>) mostrando desconto na vitrine.
              </span>
            </div>
          </div>

          {/* Peso e Tamanhos */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Peso em Gramas (Opcional)
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <Weight className="w-4 h-4" />
                </div>
                <input
                  type="number"
                  step="1"
                  value={weightGrams}
                  onChange={(e) => setWeightGrams(e.target.value)}
                  placeholder="Ex: 1200"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl pl-9 pr-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Tamanhos Disponíveis (Opcional)
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <Tag className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={sizesInput}
                  onChange={(e) => setSizesInput(e.target.value)}
                  placeholder="Ex: 50cm, 30cm, Único"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl pl-9 pr-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Gerenciamento de Imagens */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Imagens do Produto (Mínimo 1) <span className="text-rose-400">*</span>
            </label>

            {/* Imagens prévias com fallback */}
            <div className="grid grid-cols-4 gap-3 mb-3">
              {images.map((imgUrl, idx) => (
                <div key={idx} className="relative aspect-square rounded-xl bg-slate-950 border border-slate-800 overflow-hidden group">
                  <img
                    src={imgUrl}
                    alt={`Preview ${idx}`}
                    onError={(e) => {
                      e.target.onerror = null
                      e.target.src = 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80'
                    }}
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveImage(idx)}
                    className="absolute top-1 right-1 p-1 bg-rose-600 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}

              {/* Botão de Upload de Foto */}
              <label className={`aspect-square rounded-xl border-2 border-dashed border-slate-800 hover:border-indigo-500 bg-slate-950/60 flex flex-col items-center justify-center cursor-pointer transition-colors ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
                <Upload className="w-5 h-5 text-indigo-400 mb-1" />
                <span className="text-[11px] text-slate-400 font-medium">
                  {uploading ? 'Enviando...' : 'Enviar Foto'}
                </span>
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </label>
            </div>

            {/* Campo Adicionar por URL */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <Link className="w-4 h-4" />
                </div>
                <input
                  type="url"
                  value={imageUrlInput}
                  onChange={(e) => setImageUrlInput(e.target.value)}
                  placeholder="Ou cole o link direto da imagem (http://...)"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none"
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

          {/* Checkbox Frete Grátis & Ativo */}
          <div className="space-y-3 pt-2 border-t border-slate-800/80">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="freeShippingCheckbox"
                checked={isFreeShipping}
                onChange={(e) => setIsFreeShipping(e.target.checked)}
                className="w-4 h-4 rounded bg-slate-950 border-slate-800 text-emerald-500 focus:ring-emerald-500 cursor-pointer"
              />
              <label htmlFor="freeShippingCheckbox" className="text-sm font-semibold text-emerald-400 cursor-pointer flex items-center gap-2">
                <Truck className="w-4 h-4 text-emerald-400" />
                <span>Oferecer Frete Grátis para este produto</span>
              </label>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="activeCheckbox"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
                className="w-4 h-4 rounded bg-slate-950 border-slate-800 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
              />
              <label htmlFor="activeCheckbox" className="text-sm font-medium text-slate-200 cursor-pointer">
                Produto Ativo (Visível na loja e vitrine)
              </label>
            </div>
          </div>

          {/* Botões do Modal */}
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
              disabled={saving || uploading}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm shadow-lg shadow-indigo-600/20 transition-all disabled:opacity-50"
            >
              {saving ? 'Salvando...' : 'Salvar Produto'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
