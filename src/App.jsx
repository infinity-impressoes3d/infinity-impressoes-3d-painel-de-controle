import React, { useState } from 'react'
import { AuthProvider, useAuth } from './context/AuthContext'
import Sidebar from './components/layout/Sidebar'
import Header from './components/layout/Header'
import LoginForm from './components/auth/LoginForm'
import DashboardOverview from './components/dashboard/DashboardOverview'
import FinanceDashboard from './components/finances/FinanceDashboard'
import OrderList from './components/orders/OrderList'
import ProductList from './components/products/ProductList'
import ProductModal from './components/products/ProductModal'
import CollectionList from './components/collections/CollectionList'
import CollectionModal from './components/collections/CollectionModal'
import HeroSlideList from './components/hero/HeroSlideList'
import InfinitePaySettings from './components/settings/InfinitePaySettings'

function AdminApp() {
  const { user, loading } = useAuth()
  const [activeTab, setActiveTab] = useState('dashboard')
  const [isMobileOpen, setIsMobileOpen] = useState(false)

  // Modais State
  const [isProductModalOpen, setIsProductModalOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState(null)

  const [isCollectionModalOpen, setIsCollectionModalOpen] = useState(false)
  const [editingCollection, setEditingCollection] = useState(null)

  // Product Modal Handlers
  const handleOpenCreateProduct = () => {
    setEditingProduct(null)
    setIsProductModalOpen(true)
  }

  const handleOpenEditProduct = (product) => {
    setEditingProduct(product)
    setIsProductModalOpen(true)
  }

  // Collection Modal Handlers
  const handleOpenCreateCollection = () => {
    setEditingCollection(null)
    setIsCollectionModalOpen(true)
  }

  const handleOpenEditCollection = (collection) => {
    setEditingCollection(collection)
    setIsCollectionModalOpen(true)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-slate-400">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-medium">Carregando painel de controle...</span>
        </div>
      </div>
    )
  }

  if (!user) {
    return <LoginForm />
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex">
      {/* Sidebar Desktop & Mobile Drawer */}
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab}
        isMobileOpen={isMobileOpen}
        setIsMobileOpen={setIsMobileOpen}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <Header
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          isMobileOpen={isMobileOpen}
          setIsMobileOpen={setIsMobileOpen}
        />

        <main className="flex-1 p-4 md:p-8 max-w-7xl w-full mx-auto">
          {activeTab === 'dashboard' && (
            <DashboardOverview
              setActiveTab={setActiveTab}
              onOpenProductModal={handleOpenCreateProduct}
              onOpenCollectionModal={handleOpenCreateCollection}
            />
          )}

          {activeTab === 'finances' && <FinanceDashboard />}

          {activeTab === 'orders' && <OrderList />}

          {activeTab === 'products' && (
            <ProductList
              onCreateProduct={handleOpenCreateProduct}
              onEditProduct={handleOpenEditProduct}
            />
          )}

          {activeTab === 'collections' && (
            <CollectionList
              onCreateCollection={handleOpenCreateCollection}
              onEditCollection={handleOpenEditCollection}
            />
          )}

          {activeTab === 'hero' && <HeroSlideList />}

          {activeTab === 'integrations' && <InfinitePaySettings />}
        </main>
      </div>

      {/* Modais da Aplicação */}
      <ProductModal
        isOpen={isProductModalOpen}
        onClose={() => setIsProductModalOpen(false)}
        product={editingProduct}
        onSave={() => {
          window.dispatchEvent(new Event('products-updated'))
        }}
      />

      <CollectionModal
        isOpen={isCollectionModalOpen}
        onClose={() => setIsCollectionModalOpen(false)}
        collection={editingCollection}
        onSave={() => {
          window.dispatchEvent(new Event('collections-updated'))
        }}
      />
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AdminApp />
    </AuthProvider>
  )
}
