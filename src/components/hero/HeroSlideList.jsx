import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import HeroSlideModal from './HeroSlideModal'
import ConfirmDeleteModal from '../common/ConfirmDeleteModal'
import { 
  Sparkles, 
  Plus, 
  Trash2, 
  Edit3, 
  Eye, 
  EyeOff, 
  Image as ImageIcon,
  ArrowUp,
  ArrowDown
} from 'lucide-react'

export default function HeroSlideList() {
  const [slides, setSlides] = useState([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingSlide, setEditingSlide] = useState(null)

  // Confirm delete modal
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    fetchSlides()

    // Realtime subscription
    const channel = supabase
      .channel('hero-slides-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hero_slides' }, () => fetchSlides())
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const fetchSlides = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('hero_slides')
        .select('*')
        .order('display_order', { ascending: true })

      if (error) throw error
      setSlides(data || [])
    } catch (err) {
      console.error('Erro ao buscar slides hero:', err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleToggleActive = async (slide) => {
    try {
      const { error } = await supabase
        .from('hero_slides')
        .update({ active: !slide.active })
        .eq('id', slide.id)

      if (error) throw error
      fetchSlides()
    } catch (err) {
      alert('Erro ao atualizar slide: ' + err.message)
    }
  }

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return

    try {
      setDeleting(true)
      const { error } = await supabase
        .from('hero_slides')
        .delete()
        .eq('id', deleteTarget.id)

      if (error) throw error
      setSlides(slides.filter(s => s.id !== deleteTarget.id))
      setDeleteTarget(null)
    } catch (err) {
      alert('Erro ao excluir slide: ' + err.message)
    } finally {
      setDeleting(false)
    }
  }

  const handleOpenModal = (slide = null) => {
    setEditingSlide(slide)
    setIsModalOpen(true)
  }

  const handleMoveOrder = async (index, direction) => {
    const targetIndex = index + direction
    if (targetIndex < 0 || targetIndex >= slides.length) return

    const newSlides = [...slides]
    const temp = newSlides[index]
    newSlides[index] = newSlides[targetIndex]
    newSlides[targetIndex] = temp

    try {
      await Promise.all([
        supabase.from('hero_slides').update({ display_order: index }).eq('id', newSlides[index].id),
        supabase.from('hero_slides').update({ display_order: targetIndex }).eq('id', newSlides[targetIndex].id)
      ])
      fetchSlides()
    } catch (err) {
      console.error('Erro ao reordenar slides:', err)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-indigo-400" /> Banners da Seção Hero (Vitrine)
          </h2>
          <p className="text-slate-400 text-xs mt-0.5">
            Envie e gerencie os banners do carrossel principal da sua loja.
          </p>
        </div>

        <button
          onClick={() => handleOpenModal(null)}
          className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-lg shadow-indigo-600/20 flex items-center gap-1.5 transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" /> Adicionar Banner / Slide
        </button>
      </div>

      {/* Grid de Banners */}
      {loading ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-400 flex flex-col items-center gap-3">
          <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">Carregando banners da vitrine...</span>
        </div>
      ) : slides.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center space-y-3">
          <ImageIcon className="w-12 h-12 text-slate-600 mx-auto" />
          <h3 className="text-base font-semibold text-slate-300">Nenhum banner cadastrado</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Envie sua imagem para a seção hero da loja principal.
          </p>
          <button
            onClick={() => handleOpenModal(null)}
            className="mt-2 bg-indigo-600 text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-lg shadow-indigo-600/20 inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Adicionar Banner
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {slides.map((slide, index) => (
            <div 
              key={slide.id} 
              className={`bg-slate-900 border rounded-2xl overflow-hidden shadow-xl transition-all ${
                slide.active ? 'border-slate-800' : 'border-slate-800/60 opacity-60'
              }`}
            >
              {/* Preview Banner */}
              <div className="relative aspect-video bg-slate-950 overflow-hidden group">
                <img 
                  src={slide.image} 
                  alt={`Slide ${index + 1}`} 
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />

                <div className="absolute top-3 left-3">
                  <span className="text-[10px] font-bold text-white bg-black/70 backdrop-blur-md border border-white/20 px-2.5 py-1 rounded-md shadow-md">
                    Slide #{index + 1}
                  </span>
                </div>

                {/* Status Badge Top Right */}
                <div className="absolute top-3 right-3 flex items-center gap-2">
                  <button
                    onClick={() => handleToggleActive(slide)}
                    className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 shadow-lg backdrop-blur-md transition-all cursor-pointer ${
                      slide.active
                        ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300'
                        : 'bg-rose-500/20 border border-rose-500/40 text-rose-300'
                    }`}
                  >
                    {slide.active ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                    {slide.active ? 'Ativo' : 'Oculto'}
                  </button>
                </div>
              </div>

              {/* Slide Footer Actions */}
              <div className="p-4 flex items-center justify-between border-t border-slate-800 bg-slate-900">
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleMoveOrder(index, -1)}
                    disabled={index === 0}
                    title="Mover para Cima"
                    className="p-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-400 hover:text-white disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleMoveOrder(index, 1)}
                    disabled={index === slides.length - 1}
                    title="Mover para Baixo"
                    className="p-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-400 hover:text-white disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleOpenModal(slide)}
                    className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-indigo-500 text-slate-300 hover:text-indigo-400 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" /> Trocar Imagem
                  </button>
                  <button
                    onClick={() => setDeleteTarget(slide)}
                    className="p-2 rounded-xl bg-slate-950 border border-slate-800 hover:border-rose-500 text-slate-400 hover:text-rose-400 transition-all cursor-pointer"
                    title="Excluir Banner"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Edição / Criação */}
      <HeroSlideModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        slide={editingSlide}
        onSave={fetchSlides}
      />

      {/* Modal Confirmação de Exclusão */}
      <ConfirmDeleteModal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        title="Excluir Banner Hero"
        message={deleteTarget ? `Tem certeza que deseja remover este banner da loja?` : ''}
        loading={deleting}
      />
    </div>
  )
}
