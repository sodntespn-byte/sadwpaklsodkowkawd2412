import { motion, AnimatePresence } from 'framer-motion'
import { useApp } from './context/AppContext'
import LoginPage from './components/auth/LoginPage'
import MainApp from './components/MainApp'

export default function App() {
  const { currentUser } = useApp()

  return (
    <AnimatePresence mode="wait">
      {!currentUser ? (
        <motion.div
          key="login"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          <LoginPage />
        </motion.div>
      ) : (
        <motion.div
          key="app"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="flex h-screen overflow-hidden"
        >
          <MainApp />
        </motion.div>
      )}
    </AnimatePresence>
  )
}
