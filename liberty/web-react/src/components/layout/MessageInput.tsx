import { useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useApp } from '../../context/AppContext'

interface Props {
  placeholder: string
}

export default function MessageInput({ placeholder }: Props) {
  const [text, setText] = useState('')
  const { sendMessage } = useApp()

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      if (text.trim()) {
        sendMessage(text)
        setText('')
      }
    },
    [text, sendMessage]
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        if (text.trim()) {
          sendMessage(text)
          setText('')
        }
      }
    },
    [text, sendMessage]
  )

  return (
    <div className="p-4 border-t border-liberty-black-lighter">
      <form onSubmit={handleSubmit} className="flex items-end gap-2">
        <button
          type="button"
          className="w-10 h-10 rounded flex items-center justify-center hover:bg-liberty-black-light text-gray-400 hover:text-liberty-yellow transition-colors flex-shrink-0"
        >
          <i className="fas fa-plus" />
        </button>
        <div className="flex-1 relative">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            rows={1}
            className="w-full px-4 py-3 pr-12 rounded-xl bg-liberty-black-light border border-liberty-black-lighter text-white placeholder-gray-500 focus:border-liberty-yellow focus:outline-none resize-none max-h-32"
          />
          <div className="absolute right-2 bottom-2 flex gap-1">
            <button
              type="button"
              className="w-8 h-8 rounded flex items-center justify-center hover:bg-liberty-black-lighter text-gray-400 hover:text-white transition-colors"
            >
              <i className="fas fa-image" />
            </button>
            <button
              type="button"
              className="w-8 h-8 rounded flex items-center justify-center hover:bg-liberty-black-lighter text-gray-400 hover:text-white transition-colors"
            >
              <i className="fas fa-smile" />
            </button>
          </div>
        </div>
        <motion.button
          type="submit"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="w-10 h-10 rounded-full bg-liberty-yellow flex items-center justify-center text-black hover:bg-liberty-yellow-gold transition-colors flex-shrink-0"
        >
          <i className="fas fa-paper-plane" />
        </motion.button>
      </form>
    </div>
  )
}
