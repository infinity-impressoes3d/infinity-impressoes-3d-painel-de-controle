import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import ConfirmDeleteModal from '../common/ConfirmDeleteModal'
import { 
  FolderTree, 
  Plus, 
  ArrowUp, 
  ArrowDown, 
  Star, 
  Edit3, 
  Trash2, 
  Package
} from 'lucide-react'

export default function CollectionList({ onCreateCollection, onEditCollection }) {
  const [collections, setCollections] = useState([])
  const [loading, setLoading] = useState(true)
  
  // Modal de confirmação de exclusão
  const [deleteTarget, setDeleteTarget] = useState(null) // { id, name }
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    fetchCollections()

    const handleCollectionsUpdated = () => {
      fetchCollections()
    }
    window.addEventListener('collections-updated', handleCollectionsUpdated)

    const channel = supabase
      .channel('collections-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'collections' },
        () => {
          fetchCollections()
        }
      )
      .subscribe()

    return () => {
      window.removeEventListener('collections-updated', handleCollectionsUpdated)
      supabase.removeChannel(channel)
    }
  }, [])

  const fetchCollections = async () => {
    try {
      setLoading(true)

      // 1. Busca todas as coleções de forma simples e 100% segura
      const { data: cols, error: colError } = await supabase
        .from('collections')
        .select('*')
        .order('display_order', { ascending: true })

      if (colError) throw colError

      // 2. Busca todas as relações N:N de produtos x coleções
      const { data: prodRels } = await supabase
        .from('product_collections')
        .select('product_id, collection_id')

      // 3. Busca todos os produtos com suas imagens
      const { data: allProducts } = await supabase
        .from('products')
        .select('id, collection_id, images')

      const countMap = {}
      const firstImageMap = {}

      if (cols) {
        cols.forEach(c => {
          countMap[c.id] = 0
          firstImageMap[c.id] = null
        })
      }

      if (cols && allProducts) {
        cols.forEach(c => {
          const relatedProdIds = prodRels
            ? prodRels.filter(r => r.collection_id === c.id).map(r => r.product_id)
            : []

          const prodsInCollection = allProducts.filter(p => 
            relatedProdIds.includes(p.id) || p.collection_id === c.id
          )

          countMap[c.id] = prodsInCollection.length

          // Se a coleção não tiver foto própria, pega a foto do primeiro produto
          if (!c.image && prodsInCollection.length > 0) {
            const prodWithImg = prodsInCollection.find(p => p.images && p.images.length > 0)
            if (prodWithImg) {
              firstImageMap[c.id] = prodWithImg.images[0]
            }
          }
        })
      }

      const formattedCols = (cols || []).map(c => ({
        ...c,
        displayImage: c.image || firstImageMap[c.id] || null,
        products: [{ count: countMap[c.id] || 0 }]
      }))

      setCollections(formattedCols)
    } catch (err) {
      console.error('Erro ao buscar coleções:', err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleToggleFeatured = async (collection) => {
    try {
      const updatedFeatured = !collection.is_featured_home
      setCollections(collections.map(c => c.id === collection.id ? { ...c, is_featured_home: updatedFeatured } : c))

      const { error } = await supabase
        .from('collections')
        .update({ is_featured_home: updatedFeatured })
        .eq('id', collection.id)

      if (error) {
        fetchCollections()
        alert('Erro ao atualizar destaque: ' + error.message)
      }
    } catch (err) {
      fetchCollections()
    }
  }

  const handleMoveOrder = async (index, direction) => {
    if (direction === 'up' && index === 0) return
    if (direction === 'down' && index === collections.length - 1) return

    const targetIndex = direction === 'up' ? index - 1 : index + 1
    const newCollections = [...collections]

    const temp = newCollections[index]
    newCollections[index] = newCollections[targetIndex]
    newCollections[targetIndex] = temp

    const updatedCollections = newCollections.map((col, idx) => ({
      ...col,
      display_order: idx,
    }))

    setCollections(updatedCollections)

    try {
      for (const col of updatedCollections) {
        await supabase
          .from('collections')
          .update({ display_order: col.display_order })
          .eq('id', col.id)
      }
    } catch (err) {
      console.error('Erro ao reordenar coleções:', err)
      fetchCollections()
    }
  }

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return

    try {
      setDeleting(true)
      const { error } = await supabase.from('collections').delete().eq('id', deleteTarget.id)

      if (error) throw error
      setCollections(collections.filter(c => c.id !== deleteTarget.id))
      setDeleteTarget(null)
    } catch (err) {
      alert('Erro ao excluir coleção: ' + err.message)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header com Ação */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <FolderTree className="w-6 h-6 text-purple-400" /> Coleções de Produtos
          </h2>
          <p className="text-slate-400 text-xs mt-0.5">
            Organize categorias e ajuste a ordem de exibição na loja.
          </p>
        </div>

        <button
          onClick={onCreateCollection}
          className="bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold px-4 py-2.5 rounded-xl shadow-lg shadow-purple-600/20 flex items-center justify-center gap-2 transition-all"
        >
          <Plus className="w-4 h-4" /> Nova Coleção
        </button>
      </div>

      {/* Lista de Coleções */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        {loading ? (
          <div className="p-12 text-center text-slate-400 flex flex-col items-center gap-3">
            <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm">Carregando coleções...</span>
          </div>
        ) : collections.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <FolderTree className="w-12 h-12 text-slate-600 mx-auto" />
            <h3 className="text-base font-semibold text-slate-300">Nenhuma coleção cadastrada</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Crie coleções como "Decoração", "Geek & Games", "Organizadores" para categorizar seus produtos.
            </p>
            <button
              onClick={onCreateCollection}
              className="mt-2 inline-flex items-center gap-2 text-xs font-semibold text-purple-400 hover:text-purple-300"
            >
              <Plus className="w-4 h-4" /> Criar primeira coleção
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-800">
            {collections.map((collection, index) => {
              const productCount = collection.products?.[0]?.count || 0

              return (
                <div
                  key={collection.id}
                  className="p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-800/40 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex flex-col gap-1">
                      <button
                        onClick={() => handleMoveOrder(index, 'up')}
                        disabled={index === 0}
                        title="Mover para cima"
                        className="p-1 rounded bg-slate-950 border border-slate-800 hover:border-purple-500 text-slate-400 hover:text-purple-400 disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleMoveOrder(index, 'down')}
                        disabled={index === collections.length - 1}
                        title="Mover para baixo"
                        className="p-1 rounded bg-slate-950 border border-slate-800 hover:border-purple-500 text-slate-400 hover:text-purple-400 disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="w-12 h-12 rounded-xl bg-slate-950 border border-slate-800 overflow-hidden shrink-0 flex items-center justify-center">
                      {collection.displayImage || collection.image ? (
                        <img 
                          src={collection.displayImage || collection.image} 
                          alt={collection.name} 
                          className="w-full h-full object-cover" 
                        />
                      ) : (
                        <span className="text-xs font-bold text-purple-400">#{index + 1}</span>
                      )}
                    </div>

                    <div>
                      <div className="font-semibold text-white text-base flex items-center gap-2">
                        {collection.name}
                        {collection.is_featured_home && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 border border-amber-500/30 text-amber-400">
                            <Star className="w-3 h-3 fill-amber-400" /> Destaque Home
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                        <span className="flex items-center gap-1">
                          <Package className="w-3.5 h-3.5 text-slate-500" />
                          {productCount} {productCount === 1 ? 'produto' : 'produtos'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 self-end sm:self-center">
                    <button
                      onClick={() => handleToggleFeatured(collection)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                        collection.is_featured_home
                          ? 'bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <Star className={`w-3.5 h-3.5 ${collection.is_featured_home ? 'fill-amber-400' : ''}`} />
                      {collection.is_featured_home ? 'Destacado' : 'Destacar na Home'}
                    </button>

                    <button
                      onClick={() => onEditCollection(collection)}
                      className="p-2 rounded-xl bg-slate-950 border border-slate-800 hover:border-purple-500 text-slate-300 hover:text-purple-400 transition-all"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => setDeleteTarget({ id: collection.id, name: collection.name })}
                      className="p-2 rounded-xl bg-slate-950 border border-slate-800 hover:border-rose-500 text-slate-300 hover:text-rose-400 transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Modal de Confirmação de Exclusão */}
      <ConfirmDeleteModal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        title="Excluir Coleção"
        message={deleteTarget ? `Tem certeza que deseja excluir a coleção "${deleteTarget.name}"? Os produtos vinculados a ela permanecerão no catálogo sem coleção associada.` : ''}
        loading={deleting}
      />
    </div>
  )
}
