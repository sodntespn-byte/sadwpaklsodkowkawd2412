import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useApp } from '../../context/AppContext'

interface Props {
  onClose: () => void
}

export default function CreateServerModal({ onClose }: Props) {
  const [name, setName] = useState('')
  const [region, setRegion] = useState('br')
  const { createServer } = useApp()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    createServer(name.trim(), region)
    onClose()
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-liberty-black-lighter rounded-xl p-6 w-full max-w-md border border-liberty-black-card"
        >
          <h2 className="text-xl font-bold text-liberty-yellow mb-4">Criar Servidor</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Nome do servidor</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Meu Servidor"
                className="w-full px-4 py-3 rounded-lg bg-liberty-black-light border-2 border-liberty-black-lighter text-white placeholder-gray-500 focus:border-liberty-yellow focus:outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Região</label>
              <select
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-liberty-black-light border-2 border-liberty-black-lighter text-white focus:border-liberty-yellow focus:outline-none"
              >
                <option value="br">Brasil</option>
                <option value="us">EUA</option>
                <option value="eu">Europa</option>
              </select>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-3 rounded-lg border-2 border-liberty-yellow text-liberty-yellow hover:bg-liberty-yellow/10 transition-colors"
              >
                Cancelar
              </button>
              <motion.button
                type="submit"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="flex-1 py-3 rounded-lg bg-liberty-yellow text-black font-bold hover:bg-liberty-yellow-gold transition-colors"
              >
                Criar
              </motion.button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
