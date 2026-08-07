import React from 'react'
import { useAuth } from '../../context/AuthContext'
import { LogOut, User, Menu, Circle } from 'lucide-react'

export default function Header({ activeTab, setActiveTab, isMobileOpen, setIsMobileOpen }) {
  const { user, logout } = useAuth()

  const titles = {
    dashboard: 'Visão Geral do Painel',
    finances: 'Gestão Financeira, Custos & Lucros',
    orders: 'Gestão de Vendas & Checkouts Abandonados',
    products: 'Gerenciamento de Produtos',
    collections: 'Gerenciamento de Coleções',
    hero: 'Gerenciamento de Banners da Seção Hero',
    integrations: 'Configurações de Integração (Mercado Pago)',
  }

  return (
    <header className="h-16 bg-slate-900/80 backdrop-blur-md border-b border-slate-800 px-4 md:px-8 flex items-center justify-between sticky top-0 z-30">
      <div className="flex items-center gap-3">
        {/* Mobile menu toggle */}
        <button
          onClick={() => setIsMobileOpen(!isMobileOpen)}
          className="md:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
        >
          <Menu className="w-6 h-6" />
        </button>

        <div>
          <h2 className="text-lg font-semibold text-white tracking-tight">
            {titles[activeTab] || 'Painel de Controle'}
          </h2>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* System Online Badge */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950/60 border border-emerald-800/40 text-emerald-400 text-xs font-medium">
          <Circle className="w-2 h-2 fill-emerald-400 animate-pulse" />
          <span>Sistema Operacional</span>
        </div>

        {/* User Info & Logout */}
        <div className="flex items-center gap-3 pl-3 border-l border-slate-800">
          <div className="hidden lg:block text-right">
            <div className="text-xs font-medium text-slate-200">{user?.email || 'Admin'}</div>
            <div className="text-[10px] text-slate-400">Administrador da Loja</div>
          </div>

          <div className="w-8 h-8 rounded-full bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-indigo-300 font-semibold text-xs">
            <User className="w-4 h-4" />
          </div>

          <button
            onClick={logout}
            title="Sair da Conta"
            className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>
    </header>
  )
}
