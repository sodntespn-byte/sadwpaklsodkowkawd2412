import { useState } from 'react'
import { motion } from 'framer-motion'
import ServerBar from './layout/ServerBar'
import ChannelBar from './layout/ChannelBar'
import MainContent from './layout/MainContent'
import MemberBar from './layout/MemberBar'
import CreateServerModal from './modals/CreateServerModal'
import SettingsModal from './modals/SettingsModal'

export default function MainApp() {
  const [showServerModal, setShowServerModal] = useState(false)
  const [showSettings, setShowSettings] = useState(false)

  return (
    <>
      <div className="flex h-screen w-full overflow-hidden">
        <motion.div
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 'auto', opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          <ServerBar onAddServer={() => setShowServerModal(true)} />
        </motion.div>
        <motion.div
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 'auto', opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.05 }}
          className="flex-1 flex min-w-0"
        >
          <ChannelBar onSettings={() => setShowSettings(true)} />
          <MainContent />
          <MemberBar />
        </motion.div>
      </div>

      {showServerModal && (
        <CreateServerModal onClose={() => setShowServerModal(false)} />
      )}
      {showSettings && (
        <SettingsModal onClose={() => setShowSettings(false)} />
      )}
    </>
  )
}
