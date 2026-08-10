import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import ConfirmDeleteModal from '../common/ConfirmDeleteModal'
import { 
  Package, 
  Plus, 
  Search, 
  Edit3, 
  Trash2, 
  Eye, 
  EyeOff, 
  Filter, 
  Image as ImageIcon,
  Weight,
  Tag,
  CheckCircle,
  XCircle,
  Truck,
  Pin
} from 'lucide-react'

export default function ProductList({ onEditProduct, onCreateProduct }) {
  const [products, setProducts] = useState([])
  const [collections, setCollections] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedCollection, setSelectedCollection] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  
  // Modal de confirmação de exclusão
  const [deleteTarget, setDeleteTarget] = useState(null) // { id, name }
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    fetchData()

    const handleProductsUpdated = () => {
      fetchData()
    }
    window.addEventListener('products-updated', handleProductsUpdated)

    const channel = supabase
      .channel('products-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'products' },
        () => {
          fetchData()
        }
      )
      .subscribe()

    return () => {
      window.removeEventListener('products-updated', handleProductsUpdated)
      supabase.removeChannel(channel)
    }
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      const { data: cols } = await supabase.from('collections').select('id, name').order('name')
      setCollections(cols || [])

      const { data: prods, error } = await supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error

      const collectionsMap = (cols || []).reduce((acc, c) => ({ ...acc, [c.id]: c.name }), {})
      const formattedProds = (prods || []).map(p => ({
        ...p,
        collections: p.collection_id && collectionsMap[p.collection_id] ? { id: p.collection_id, name: collectionsMap[p.collection_id] } : null
      }))

      // Ordena produtos fixados primeiro
      formattedProds.sort((a, b) => (Boolean(b.is_pinned || b.isPinned) ? 1 : 0) - (Boolean(a.is_pinned || a.isPinned) ? 1 : 0))

      setProducts(formattedProds)
    } catch (err) {
      console.error('Erro ao buscar produtos:', err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleToggleActive = async (product) => {
    try {
      const updatedActive = !product.active
      setProducts(products.map(p => p.id === product.id ? { ...p, active: updatedActive } : p))

      const { error } = await supabase
        .from('products')
        .update({ active: updatedActive, updated_at: new Date().toISOString() })
        .eq('id', product.id)

      if (error) {
        fetchData()
        alert('Erro ao alterar status do produto: ' + error.message)
      }
    } catch (err) {
      fetchData()
    }
  }

  const handleTogglePinned = async (product) => {
    try {
      const updatedPinned = !Boolean(product.is_pinned || product.isPinned)
      setProducts(prev => {
        const updated = prev.map(p => p.id === product.id ? { ...p, is_pinned: updatedPinned } : p)
        return updated.sort((a, b) => (Boolean(b.is_pinned || b.isPinned) ? 1 : 0) - (Boolean(a.is_pinned || a.isPinned) ? 1 : 0))
      })

      const { error } = await supabase
        .from('products')
        .update({ is_pinned: updatedPinned, updated_at: new Date().toISOString() })
        .eq('id', product.id)

      if (error) {
        fetchData()
        alert('Erro ao alterar fixação do produto: ' + error.message)
      }
    } catch (err) {
      fetchData()
    }
  }

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return

    try {
      setDeleting(true)
      const { error } = await supabase.from('products').delete().eq('id', deleteTarget.id)

      if (error) throw error

      setProducts(products.filter(p => p.id !== deleteTarget.id))
      setDeleteTarget(null)
    } catch (err) {
      alert('Erro ao excluir produto: ' + err.message)
    } finally {
      setDeleting(false)
    }
  }

  const filteredProducts = products.filter(product => {
    const matchesSearch = (product.name || '').toLowerCase().includes(search.toLowerCase()) ||
      (product.description && product.description.toLowerCase().includes(search.toLowerCase()))

    const matchesCollection = selectedCollection === 'all' || product.collection_id === selectedCollection

    const matchesStatus = statusFilter === 'all' ||
      (statusFilter === 'active' && product.active) ||
      (statusFilter === 'inactive' && !product.active)

    return matchesSearch && matchesCollection && matchesStatus
  })

  return (
    <div className="space-y-6">
      {/* Header com Ações e Busca */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Package className="w-6 h-6 text-indigo-400" /> Catalogação de Produtos
          </h2>
          <p className="text-slate-400 text-xs mt-0.5">
            {products.length} {products.length === 1 ? 'produto cadastrado' : 'produtos cadastrados'}
          </p>
        </div>

        <button
          onClick={onCreateProduct}
          className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold px-4 py-2.5 rounded-xl shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2 transition-all"
        >
          <Plus className="w-4 h-4" /> Novo Produto
        </button>
      </div>

      {/* Bar de Filtros */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome do produto..."
            className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl pl-10 pr-4 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none"
          />
        </div>

        <div className="w-full md:w-56">
          <select
            value={selectedCollection}
            onChange={(e) => setSelectedCollection(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none"
          >
            <option value="all">Todas as Coleções</option>
            {collections.map(col => (
              <option key={col.id} value={col.id}>{col.name}</option>
            ))}
          </select>
        </div>

        <div className="w-full md:w-44">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none"
          >
            <option value="all">Todos os Status</option>
            <option value="active">Somente Ativos</option>
            <option value="inactive">Somente Inativos</option>
          </select>
        </div>
      </div>

      {/* Tabela de Produtos */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        {loading ? (
          <div className="p-12 text-center text-slate-400 flex flex-col items-center gap-3">
            <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm">Carregando catálogo de produtos...</span>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <Package className="w-12 h-12 text-slate-600 mx-auto" />
            <h3 className="text-base font-semibold text-slate-300">Nenhum produto encontrado</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {search || selectedCollection !== 'all' || statusFilter !== 'all'
                ? 'Nenhum resultado corresponde aos filtros aplicados.'
                : 'Você ainda não cadastrou nenhum produto no banco de dados.'}
            </p>
            <button
              onClick={onCreateProduct}
              className="mt-2 inline-flex items-center gap-2 text-xs font-semibold text-indigo-400 hover:text-indigo-300"
            >
              <Plus className="w-4 h-4" /> Cadastrar primeiro produto
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-950 text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-3.5 px-4">Produto</th>
                  <th className="py-3.5 px-4">Coleção</th>
                  <th className="py-3.5 px-4">Preço</th>
                  <th className="py-3.5 px-4">Especificações</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {filteredProducts.map((product) => {
                  const firstImage = product.images && product.images.length > 0 ? product.images[0] : null
                  const collectionName = product.collections?.name || 'Sem coleção'

                  return (
                    <tr key={product.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-xl bg-slate-950 border border-slate-800 overflow-hidden shrink-0 flex items-center justify-center">
                            {firstImage ? (
                              <img src={firstImage} alt={product.name} className="w-full h-full object-cover" />
                            ) : (
                              <ImageIcon className="w-5 h-5 text-slate-600" />
                            )}
                          </div>
                          <div>
                            <div className="font-semibold text-white text-sm">{product.name}</div>
                            {product.description && (
                              <div className="text-xs text-slate-400 line-clamp-1 max-w-xs">
                                {product.description}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-950 border border-slate-800 text-slate-300">
                          {collectionName}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 font-bold text-white">
                        R$ {Number(product.price).toFixed(2).replace('.', ',')}
                      </td>

                      <td className="py-3.5 px-4 text-xs space-y-1">
                        {(product.is_pinned || product.isPinned) && (
                          <div className="flex items-center gap-1.5 text-amber-400 font-semibold">
                            <Pin className="w-3.5 h-3.5 text-amber-400 fill-amber-400/20" />
                            <span>Fixado no Topo</span>
                          </div>
                        )}
                        {(product.is_free_shipping || product.free_shipping) && (
                          <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                            <Truck className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Frete Grátis</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1.5 text-slate-400">
                          <Weight className="w-3.5 h-3.5 text-slate-500" />
                          <span>{product.weight_grams ? `${product.weight_grams}g` : 'Peso nulo (não exibe)'}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-slate-400">
                          <Tag className="w-3.5 h-3.5 text-slate-500" />
                          <span>
                            {product.sizes && product.sizes.length > 0 
                              ? product.sizes.join(', ') 
                              : 'Sem tamanhos (oculta seletor)'}
                          </span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <button
                          onClick={() => handleToggleActive(product)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all ${
                            product.active
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20'
                              : 'bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700'
                          }`}
                        >
                          {product.active ? (
                            <>
                              <CheckCircle className="w-3.5 h-3.5" /> Ativo
                            </>
                          ) : (
                            <>
                              <XCircle className="w-3.5 h-3.5" /> Inativo
                            </>
                          )}
                        </button>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleTogglePinned(product)}
                            title={product.is_pinned || product.isPinned ? "Desfixar do Topo" : "Fixar no Topo da Loja"}
                            className={`p-2 rounded-lg bg-slate-950 border transition-all ${
                              product.is_pinned || product.isPinned
                                ? 'border-amber-500/50 text-amber-400 hover:bg-amber-500/10'
                                : 'border-slate-800 text-slate-400 hover:text-amber-400 hover:border-amber-500/30'
                            }`}
                          >
                            <Pin className={`w-4 h-4 ${(product.is_pinned || product.isPinned) ? 'fill-amber-400' : ''}`} />
                          </button>
                          <button
                            onClick={() => onEditProduct(product)}
                            title="Editar Produto"
                            className="p-2 rounded-lg bg-slate-950 border border-slate-800 hover:border-indigo-500 text-slate-300 hover:text-indigo-400 transition-all"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeleteTarget({ id: product.id, name: product.name })}
                            title="Excluir Produto"
                            className="p-2 rounded-lg bg-slate-950 border border-slate-800 hover:border-rose-500 text-slate-300 hover:text-rose-400 transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de Confirmação de Exclusão */}
      <ConfirmDeleteModal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        title="Excluir Produto"
        message={deleteTarget ? `Tem certeza que deseja excluir o produto "${deleteTarget.name}"? Esta ação removerá o item do catálogo.` : ''}
        loading={deleting}
      />
    </div>
  )
}
