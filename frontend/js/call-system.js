/**
 * Liberty Call System - Sistema de Chamadas WebRTC Perfeito
 */

(function() {
    'use strict';

    // ============================================
    // CONFIGURAÇÃO
    // ============================================
    
    const CONFIG = {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
            { urls: 'stun:stun3.l.google.com:19302' },
            { urls: 'stun:stun4.l.google.com:19302' },
            {
                urls: 'turn:openrelay.metered.ca:80',
                username: 'openrelayproject',
                credential: 'openrelayproject'
            },
            {
                urls: 'turn:openrelay.metered.ca:443',
                username: 'openrelayproject',
                credential: 'openrelayproject'
            },
            {
                urls: 'turn:openrelay.metered.ca:443?transport=tcp',
                username: 'openrelayproject',
                credential: 'openrelayproject'
            }
        ],
        iceCandidatePoolSize: 10
    };

    // ============================================
    // ESTADO
    // ============================================
    
    let state = {
        status: 'idle',
        callId: null,
        targetId: null,
        targetName: null,
        targetAvatar: null,
        withVideo: false,
        isMuted: false,
        isVideoOff: false,
        isSharingScreen: false
    };

    let socket = null;
    let pc = null;
    let localStream = null;
    let screenStream = null;
    let pendingCandidates = [];
    let callStartTime = null;
    let durationInterval = null;

    // ============================================
    // UTILITÁRIOS
    // ============================================
    
    const log = (emoji, message, ...args) => {
        console.log(`%c${emoji} [Call] ${message}`, 'color: #ffc800; font-weight: bold;', ...args);
    };

    const generateCallId = () => {
        return 'call_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    };

    const getLocalUser = () => {
        return window.app?.currentUser || { id: null, username: 'Você', avatar_url: null };
    };

    // ============================================
    // SOCKET
    // ============================================
    
    const getSocket = () => {
        if (window.socket?.connected) return window.socket;
        if (window.app?._callSocket?.connected) return window.app._callSocket;
        return null;
    };

    const ensureSocket = () => {
        socket = getSocket();
        if (socket) {
            setupSocketListeners();
            return true;
        }
        
        log('⏳', 'Aguardando socket...');
        return new Promise((resolve) => {
            let attempts = 0;
            const maxAttempts = 50; // 10 segundos
            const check = () => {
                attempts++;
                socket = getSocket();
                if (socket) {
                    setupSocketListeners();
                    log('✅', 'Socket encontrado após', attempts, 'tentativas');
                    resolve(true);
                } else if (attempts >= maxAttempts) {
                    log('❌', 'Timeout aguardando socket');
                    resolve(false);
                } else {
                    setTimeout(check, 200);
                }
            };
            setTimeout(check, 200);
        });
    };

    const setupSocketListeners = () => {
        if (!socket) return;

        socket.off('call:incoming');
        socket.off('call:accepted');
        socket.off('call:rejected');
        socket.off('call:ended');
        socket.off('call:busy');
        socket.off('call:error');
        socket.off('webrtc_signal');

        socket.on('call:incoming', (data) => {
            log('📞', 'Chamada recebida:', data);
            handleIncoming(data);
        });

        socket.on('call:accepted', (data) => {
            log('✅', 'Chamada aceita:', data);
            handleAccepted(data);
        });

        socket.on('call:rejected', (data) => {
            log('❌', 'Chamada rejeitada:', data);
            handleRejected();
        });

        socket.on('call:ended', (data) => {
            log('📴', 'Chamada encerrada:', data);
            handleEnded();
        });

        socket.on('call:busy', (data) => {
            log('😕', 'Usuário ocupado:', data);
            handleBusy();
        });

        socket.on('call:error', (data) => {
            log('⚠️', 'Erro na chamada:', data);
            handleError(data);
        });

        socket.on('webrtc_signal', (data) => {
            log('📡', 'Sinal recebido:', data.kind);
            handleSignal(data);
        });

        log('✅', 'Listeners configurados');
    };

    // ============================================
    // WEBRTC
    // ============================================
    
    const createPeerConnection = async () => {
        log('🔧', 'Criando RTCPeerConnection...');
        
        pc = new RTCPeerConnection(CONFIG);

        pc.onicecandidate = (event) => {
            if (event.candidate && state.callId && state.targetId) {
                log('🧊', 'Enviando ICE candidate');
                socket.emit('webrtc_signal', {
                    to: state.targetId,
                    callId: state.callId,
                    kind: 'ice',
                    data: event.candidate.toJSON()
                });
            }
        };

        pc.oniceconnectionstatechange = () => {
            const iceState = pc?.iceConnectionState;
            log('🧊', 'Estado ICE:', iceState);
            
            if (iceState === 'connected') {
                log('✅', 'Conexão ICE estabelecida!');
            } else if (iceState === 'failed') {
                log('❌', 'ICE falhou - tentando restart');
                if (pc.restartIce) pc.restartIce();
            } else if (iceState === 'disconnected') {
                log('⚠️', 'ICE desconectado - aguardando...');
                setTimeout(() => {
                    if (pc?.iceConnectionState === 'disconnected') {
                        log('❌', 'ICE ainda desconectado - encerrando');
                        endCall();
                    }
                }, 5000);
            }
        };

        pc.ontrack = (event) => {
            log('🎵', 'Track remoto:', event.track.kind);
            
            if (event.track.kind === 'audio') {
                playRemoteAudio(event.streams[0]);
            } else if (event.track.kind === 'video') {
                showRemoteVideo(event.streams[0], event.track);
            }
        };

        if (localStream) {
            localStream.getTracks().forEach(track => {
                log('🎤', 'Adicionando track local:', track.kind);
                pc.addTrack(track, localStream);
            });
        }

        await processPendingCandidates();

        return pc;
    };

    const processPendingCandidates = async () => {
        if (pendingCandidates.length === 0) return;
        
        log('🔄', `Processando ${pendingCandidates.length} ICE candidates pendentes`);
        
        for (const candidate of pendingCandidates) {
            try {
                await pc.addIceCandidate(new RTCIceCandidate(candidate));
            } catch (e) {
                log('⚠️', 'Erro ao adicionar ICE pendente:', e.message);
            }
        }
        pendingCandidates = [];
    };

    const getLocalMedia = async (withVideo = false) => {
        log('📹', 'Obtendo mídia local, vídeo:', withVideo);
        
        const constraints = {
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            },
            video: withVideo ? {
                width: { ideal: 1280 },
                height: { ideal: 720 },
                facingMode: 'user'
            } : false
        };

        try {
            localStream = await navigator.mediaDevices.getUserMedia(constraints);
            log('✅', 'Mídia local obtida');
            return true;
        } catch (error) {
            log('❌', 'Erro ao obter mídia:', error.message);
            
            if (withVideo) {
                log('🔄', 'Tentando apenas áudio...');
                try {
                    localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
                    state.withVideo = false;
                    log('✅', 'Áudio obtido');
                    return true;
                } catch (audioError) {
                    log('❌', 'Erro ao obter áudio:', audioError.message);
                    return false;
                }
            }
            return false;
        }
    };

    const createOffer = async () => {
        if (!pc) return;
        
        log('📤', 'Criando offer...');
        
        try {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            
            socket.emit('webrtc_signal', {
                to: state.targetId,
                callId: state.callId,
                kind: 'offer',
                data: offer
            });
            
            log('✅', 'Offer enviado');
        } catch (error) {
            log('❌', 'Erro ao criar offer:', error.message);
            endCall();
        }
    };

    const createAnswer = async (offer) => {
        if (!pc) return;
        
        log('📤', 'Criando answer...');
        
        try {
            await pc.setRemoteDescription(new RTCSessionDescription(offer));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            
            socket.emit('webrtc_signal', {
                to: state.targetId,
                callId: state.callId,
                kind: 'answer',
                data: answer
            });
            
            log('✅', 'Answer enviado');
        } catch (error) {
            log('❌', 'Erro ao criar answer:', error.message);
            endCall();
        }
    };

    const handleSignal = async (data) => {
        const { kind, data: signalData } = data;
        
        log('📡', `Processando sinal: ${kind}`);
        
        if (!pc && kind === 'ice') {
            log('💾', 'Armazenando ICE candidate (PC não pronto)');
            pendingCandidates.push(signalData);
            return;
        }

        if (!pc) {
            log('⚠️', 'PC não existe, ignorando sinal:', kind);
            return;
        }

        try {
            if (kind === 'offer') {
                await pc.setRemoteDescription(new RTCSessionDescription(signalData));
                await createAnswer(signalData);
            } else if (kind === 'answer') {
                await pc.setRemoteDescription(new RTCSessionDescription(signalData));
                log('✅', 'Answer processado');
            } else if (kind === 'ice') {
                if (pc.remoteDescription) {
                    await pc.addIceCandidate(new RTCIceCandidate(signalData));
                    log('✅', 'ICE candidate adicionado');
                } else {
                    pendingCandidates.push(signalData);
                    log('💾', 'ICE armazenado (sem remote description)');
                }
            }
        } catch (error) {
            log('❌', `Erro ao processar ${kind}:`, error.message);
        }
    };

    // ============================================
    // ÁUDIO E VÍDEO
    // ============================================
    
    const playRemoteAudio = (stream) => {
        log('🔊', 'Configurando áudio remoto');
        
        let audioEl = document.getElementById('remote-audio');
        if (!audioEl) {
            audioEl = document.createElement('audio');
            audioEl.id = 'remote-audio';
            audioEl.autoplay = true;
            audioEl.playsInline = true;
            audioEl.muted = false; // Garantir que não está mudo
            audioEl.volume = 1.0; // Volume máximo
            document.body.appendChild(audioEl);
        }
        
        audioEl.srcObject = stream;
        audioEl.muted = false;
        audioEl.volume = 1.0;
        
        // Tentar reproduzir com tratamento de autoplay
        const playPromise = audioEl.play();
        if (playPromise !== undefined) {
            playPromise.then(() => {
                log('✅', 'Áudio remoto reproduzindo');
            }).catch(e => {
                log('⚠️', 'Autoplay bloqueado, aguardando interação');
                // Tentar reproduzir após interação do usuário
                const resumeAudio = () => {
                    audioEl.play().then(() => {
                        log('✅', 'Áudio retomado após interação');
                        document.removeEventListener('click', resumeAudio);
                    }).catch(() => {});
                };
                document.addEventListener('click', resumeAudio, { once: true });
            });
        }
    };

    const showRemoteVideo = (stream, track) => {
        log('📺', 'Configurando vídeo remoto');
        
        const isScreen = track.label?.toLowerCase().includes('screen') ||
                         track.label?.toLowerCase().includes('window') ||
                         track.label?.toLowerCase().includes('tab');
        
        if (isScreen) {
            showScreenShare(stream);
            return;
        }
        
        let videoEl = document.getElementById('remote-video');
        if (!videoEl) {
            videoEl = document.createElement('video');
            videoEl.id = 'remote-video';
            videoEl.autoplay = true;
            videoEl.playsInline = true;
            videoEl.muted = false;
            document.body.appendChild(videoEl);
        }
        
        videoEl.srcObject = stream;
        videoEl.style.cssText = 'position:fixed;bottom:100px;right:20px;width:240px;height:180px;border-radius:12px;background:#111;object-fit:cover;z-index:100000;box-shadow:0 8px 32px rgba(0,0,0,0.5);border:2px solid #5865f2;';
        videoEl.play().catch(() => {});
    };

    const showScreenShare = (stream) => {
        log('🖥️', 'Mostrando tela compartilhada');
        
        let screenEl = document.getElementById('screen-share');
        if (!screenEl) {
            screenEl = document.createElement('video');
            screenEl.id = 'screen-share';
            screenEl.autoplay = true;
            screenEl.playsInline = true;
            screenEl.muted = true;
            document.body.appendChild(screenEl);
        }
        
        screenEl.srcObject = stream;
        screenEl.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);max-width:80vw;max-height:80vh;border-radius:12px;background:#000;z-index:100001;box-shadow:0 16px 64px rgba(0,0,0,0.8);';
        screenEl.play().catch(() => {});
    };

    const showLocalVideo = () => {
        if (!localStream) return;
        
        let videoEl = document.getElementById('local-video');
        if (!videoEl) {
            videoEl = document.createElement('video');
            videoEl.id = 'local-video';
            videoEl.autoplay = true;
            videoEl.playsInline = true;
            videoEl.muted = true;
            document.body.appendChild(videoEl);
        }
        
        videoEl.srcObject = localStream;
        videoEl.style.cssText = 'position:fixed;bottom:100px;right:270px;width:240px;height:180px;border-radius:12px;background:#111;object-fit:cover;z-index:100000;box-shadow:0 8px 32px rgba(0,0,0,0.5);border:2px solid #ffc800;';
    };

    // ============================================
    // CONTROLES
    // ============================================
    
    const toggleMute = () => {
        if (!localStream) return;
        
        state.isMuted = !state.isMuted;
        localStream.getAudioTracks().forEach(track => {
            track.enabled = !state.isMuted;
        });
        
        updateUI();
        log('🎤', 'Mudo:', state.isMuted);
    };

    const toggleVideo = () => {
        if (!localStream) return;
        
        const videoTracks = localStream.getVideoTracks();
        
        if (videoTracks.length === 0) {
            navigator.mediaDevices.getUserMedia({ video: true, audio: false })
                .then(stream => {
                    const track = stream.getVideoTracks()[0];
                    localStream.addTrack(track);
                    
                    const sender = pc?.getSenders().find(s => s.track?.kind === 'video');
                    if (sender) {
                        sender.replaceTrack(track);
                    } else if (pc) {
                        pc.addTrack(track, localStream);
                    }
                    
                    state.isVideoOff = false;
                    showLocalVideo();
                    updateUI();
                })
                .catch(e => {
                    log('❌', 'Erro ao ativar vídeo:', e.message);
                });
            return;
        }
        
        state.isVideoOff = !state.isVideoOff;
        videoTracks.forEach(track => {
            track.enabled = !state.isVideoOff;
        });
        
        updateUI();
        log('📹', 'Vídeo off:', state.isVideoOff);
    };

    const toggleScreenShare = async () => {
        if (state.isSharingScreen) {
            stopScreenShare();
        } else {
            await startScreenShare();
        }
    };

    const startScreenShare = async () => {
        try {
            screenStream = await navigator.mediaDevices.getDisplayMedia({
                video: true,
                audio: true
            });
            
            const videoTrack = screenStream.getVideoTracks()[0];
            
            const sender = pc?.getSenders().find(s => s.track?.kind === 'video');
            if (sender) {
                sender.replaceTrack(videoTrack);
            }
            
            state.isSharingScreen = true;
            updateUI();
            
            videoTrack.onended = () => {
                stopScreenShare();
            };
            
            log('🖥️', 'Compartilhando tela');
        } catch (error) {
            log('❌', 'Erro ao compartilhar tela:', error.message);
        }
    };

    const stopScreenShare = () => {
        if (!screenStream) return;
        
        screenStream.getTracks().forEach(track => track.stop());
        screenStream = null;
        
        if (localStream && !state.isVideoOff) {
            const cameraTrack = localStream.getVideoTracks()[0];
            const sender = pc?.getSenders().find(s => s.track?.kind === 'video');
            if (sender && cameraTrack) {
                sender.replaceTrack(cameraTrack);
            }
        }
        
        state.isSharingScreen = false;
        updateUI();
        
        log('🖥️', 'Tela parou de compartilhar');
    };

    // ============================================
    // CHAMADAS
    // ============================================
    
    let lastCallAttempt = 0;
    const CALL_DEBOUNCE_MS = 1000; // 1 segundo de debounce
    
    const startCall = async (targetId, withVideo = false) => {
        // Debounce para prevenir chamadas duplicadas
        const now = Date.now();
        if (now - lastCallAttempt < CALL_DEBOUNCE_MS) {
            log('⏳', 'Chamada ignorada (debounce)');
            return;
        }
        lastCallAttempt = now;
        
        if (state.status !== 'idle') {
            alert('Já está em uma chamada');
            return;
        }

        log('📞', 'Iniciando chamada para:', targetId);
        
        if (!socket) {
            await ensureSocket();
        }
        
        if (!socket?.connected) {
            alert('Não conectado ao servidor');
            return;
        }

        const gotMedia = await getLocalMedia(withVideo);
        if (!gotMedia) {
            alert('Não foi possível acessar microfone/câmera');
            return;
        }

        state = {
            ...state,
            status: 'calling',
            callId: generateCallId(),
            targetId: String(targetId),
            targetName: 'Usuário',
            withVideo: withVideo && localStream.getVideoTracks().length > 0
        };

        const localUser = getLocalUser();
        socket.emit('call:request', {
            to: state.targetId,
            callId: state.callId,
            from: String(localUser.id),
            fromName: localUser.username || 'Usuário',
            withVideo: state.withVideo
        });

        showUI('calling');
    };

    const handleIncoming = (data) => {
        if (state.status !== 'idle') {
            socket.emit('call:busy', {
                to: data.from,
                callId: data.callId
            });
            return;
        }

        state = {
            ...state,
            status: 'receiving',
            callId: data.callId,
            targetId: String(data.from),
            targetName: data.fromName || 'Usuário',
            targetAvatar: data.fromAvatar,
            withVideo: data.withVideo
        };

        showUI('incoming');
    };

    const acceptCall = async () => {
        if (state.status !== 'receiving') return;

        log('✅', 'Aceitando chamada');
        
        const gotMedia = await getLocalMedia(state.withVideo);
        if (!gotMedia) {
            alert('Não foi possível acessar microfone/câmera');
            rejectCall();
            return;
        }

        await createPeerConnection();

        state.status = 'connected';

        socket.emit('call:accept', {
            to: state.targetId,
            callId: state.callId
        });

        showUI('connected');
        
        if (state.withVideo) {
            showLocalVideo();
        }

        startDurationTimer();
    };

    const rejectCall = () => {
        if (state.status !== 'receiving') return;

        socket.emit('call:reject', {
            to: state.targetId,
            callId: state.callId
        });

        cleanup();
    };

    const handleAccepted = async (data) => {
        if (state.status !== 'calling') return;

        log('✅', 'Chamada aceita pelo outro lado');
        
        await createPeerConnection();
        await createOffer();

        state.status = 'connected';
        showUI('connected');
        
        if (state.withVideo) {
            showLocalVideo();
        }
        
        startDurationTimer();
    };

    const handleRejected = () => {
        alert('Chamada rejeitada');
        cleanup();
    };

    const handleBusy = () => {
        alert('Usuário ocupado');
        cleanup();
    };

    const handleEnded = () => {
        cleanup();
    };

    const handleError = (data) => {
        alert('Erro na chamada: ' + (data.message || 'Erro desconhecido'));
        cleanup();
    };

    const endCall = () => {
        if (state.callId && state.targetId) {
            socket.emit('call:end', {
                to: state.targetId,
                callId: state.callId
            });
        }
        cleanup();
    };

    const cleanup = () => {
        log('🧹', 'Limpando...');
        
        stopDurationTimer();
        
        if (pc) {
            pc.close();
            pc = null;
        }
        
        if (localStream) {
            localStream.getTracks().forEach(t => t.stop());
            localStream = null;
        }
        
        if (screenStream) {
            screenStream.getTracks().forEach(t => t.stop());
            screenStream = null;
        }
        
        pendingCandidates = [];
        
        state = {
            status: 'idle',
            callId: null,
            targetId: null,
            targetName: null,
            targetAvatar: null,
            withVideo: false,
            isMuted: false,
            isVideoOff: false,
            isSharingScreen: false
        };
        
        hideUI();
        
        ['remote-audio', 'remote-video', 'local-video', 'screen-share'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.remove();
        });
    };

    // ============================================
    // TIMER
    // ============================================
    
    const startDurationTimer = () => {
        callStartTime = Date.now();
        durationInterval = setInterval(updateDuration, 1000);
    };

    const stopDurationTimer = () => {
        if (durationInterval) {
            clearInterval(durationInterval);
            durationInterval = null;
        }
        callStartTime = null;
    };

    const updateDuration = () => {
        if (!callStartTime) return;
        
        const elapsed = Math.floor((Date.now() - callStartTime) / 1000);
        const minutes = Math.floor(elapsed / 60).toString().padStart(2, '0');
        const seconds = (elapsed % 60).toString().padStart(2, '0');
        
        const durationEl = document.getElementById('call-duration');
        if (durationEl) {
            durationEl.textContent = `${minutes}:${seconds}`;
        }
    };

    // ============================================
    // UI
    // ============================================
    
    const injectStyles = () => {
        if (document.getElementById('call-system-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'call-system-styles';
        style.textContent = `
            .call-overlay {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.85);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 99999;
                backdrop-filter: blur(10px);
            }
            
            .call-card {
                background: linear-gradient(145deg, #1a1a1a, #0d0d0d);
                border-radius: 24px;
                padding: 40px;
                text-align: center;
                box-shadow: 0 24px 80px rgba(0, 0, 0, 0.6);
                border: 1px solid rgba(255, 200, 0, 0.2);
                min-width: 320px;
                animation: callCardIn 0.3s ease-out;
            }
            
            @keyframes callCardIn {
                from { opacity: 0; transform: scale(0.9) translateY(20px); }
                to { opacity: 1; transform: scale(1) translateY(0); }
            }
            
            .call-avatar {
                width: 100px;
                height: 100px;
                border-radius: 50%;
                background: linear-gradient(135deg, #ffc800, #ff9500);
                display: flex;
                align-items: center;
                justify-content: center;
                margin: 0 auto 24px;
                font-size: 40px;
                color: #000;
                font-weight: bold;
                box-shadow: 0 8px 32px rgba(255, 200, 0, 0.3);
            }
            
            .call-avatar img {
                width: 100%;
                height: 100%;
                border-radius: 50%;
                object-fit: cover;
            }
            
            .call-title {
                color: #fff;
                font-size: 24px;
                font-weight: 600;
                margin: 0 0 8px;
            }
            
            .call-subtitle {
                color: #888;
                font-size: 14px;
                margin: 0 0 32px;
            }
            
            .call-buttons {
                display: flex;
                gap: 16px;
                justify-content: center;
            }
            
            .call-btn {
                border: none;
                padding: 16px 32px;
                border-radius: 16px;
                font-size: 16px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s;
                display: flex;
                align-items: center;
                gap: 8px;
            }
            
            .call-btn:hover { transform: scale(1.05); }
            
            .call-btn-accept {
                background: linear-gradient(135deg, #ffc800, #ff9500);
                color: #000;
            }
            
            .call-btn-reject {
                background: linear-gradient(135deg, #ff3366, #cc2952);
                color: #fff;
            }
            
            .call-btn-end {
                background: linear-gradient(135deg, #ff3366, #cc2952);
                color: #fff;
            }
            
            .call-header {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                height: 80px;
                background: linear-gradient(180deg, rgba(0,0,0,0.9), rgba(0,0,0,0));
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 0 24px;
                pointer-events: auto;
            }
            
            .call-header-info {
                display: flex;
                align-items: center;
                gap: 16px;
            }
            
            .call-header-avatar {
                width: 48px;
                height: 48px;
                border-radius: 50%;
                background: linear-gradient(135deg, #5865f2, #eb459e);
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 20px;
                color: #fff;
                font-weight: bold;
            }
            
            .call-header-text { text-align: left; }
            
            .call-header-name {
                color: #fff;
                font-size: 18px;
                font-weight: 600;
            }
            
            .call-header-duration {
                color: #ffc800;
                font-size: 14px;
            }
            
            .call-controls {
                position: fixed;
                bottom: 24px;
                left: 50%;
                transform: translateX(-50%);
                display: flex;
                gap: 12px;
                background: rgba(26, 26, 26, 0.95);
                padding: 16px 24px;
                border-radius: 24px;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
                border: 1px solid rgba(255, 255, 255, 0.1);
                pointer-events: auto;
            }
            
            .call-control-btn {
                width: 56px;
                height: 56px;
                border-radius: 50%;
                border: none;
                background: #2a2a2a;
                color: #fff;
                font-size: 20px;
                cursor: pointer;
                transition: all 0.2s;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            .call-control-btn:hover {
                background: #3a3a3a;
                transform: scale(1.1);
            }
            
            .call-control-btn.active {
                background: #ffc800;
                color: #000;
            }
            
            .call-control-btn.danger { background: #ff3366; }
            .call-control-btn.danger:hover { background: #ff4477; }
            
            @keyframes callPulse {
                0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(255, 200, 0, 0.4); }
                50% { transform: scale(1.05); box-shadow: 0 0 0 20px rgba(255, 200, 0, 0); }
            }
            
            .call-avatar.calling {
                animation: callPulse 2s ease-in-out infinite;
            }
        `;
        document.head.appendChild(style);
    };

    const showUI = (type) => {
        hideUI();
        injectStyles();
        
        const overlay = document.createElement('div');
        overlay.className = 'call-overlay';
        overlay.id = 'call-overlay';
        
        const card = document.createElement('div');
        card.className = 'call-card';
        
        const initial = (state.targetName || 'U').charAt(0).toUpperCase();
        
        if (type === 'calling') {
            card.innerHTML = '<div class="call-avatar calling">' + (state.targetAvatar ? '<img src="' + state.targetAvatar + '" onerror="this.style.display=\'none\'">' : initial) + '</div>' +
                '<h2 class="call-title">A chamar...</h2>' +
                '<p class="call-subtitle">' + (state.targetName || 'Usuário') + '</p>' +
                '<div class="call-buttons">' +
                '<button class="call-btn call-btn-end" id="call-cancel">Cancelar</button>' +
                '</div>';
        } else if (type === 'incoming') {
            card.innerHTML = '<div class="call-avatar">' + (state.targetAvatar ? '<img src="' + state.targetAvatar + '" onerror="this.style.display=\'none\'">' : initial) + '</div>' +
                '<h2 class="call-title">Chamada recebida</h2>' +
                '<p class="call-subtitle">' + (state.targetName || 'Usuário') + ' está a chamar' + (state.withVideo ? ' com vídeo' : '') + '</p>' +
                '<div class="call-buttons">' +
                '<button class="call-btn call-btn-accept" id="call-accept">Aceitar</button>' +
                '<button class="call-btn call-btn-reject" id="call-reject">Recusar</button>' +
                '</div>';
        } else if (type === 'connected') {
            overlay.style.background = 'transparent';
            overlay.style.pointerEvents = 'none';
            
            card.innerHTML = '<div class="call-header">' +
                '<div class="call-header-info">' +
                '<div class="call-header-avatar">' + (state.targetAvatar ? '<img src="' + state.targetAvatar + '" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">' : initial) + '</div>' +
                '<div class="call-header-text">' +
                '<div class="call-header-name">' + (state.targetName || 'Usuário') + '</div>' +
                '<div class="call-header-duration" id="call-duration">00:00</div>' +
                '</div></div></div>' +
                '<div class="call-controls">' +
                '<button class="call-control-btn' + (state.isMuted ? ' active' : '') + '" id="call-mute" title="Microfone">🎤</button>' +
                '<button class="call-control-btn' + (state.isVideoOff ? '' : ' active') + '" id="call-video" title="Vídeo">📹</button>' +
                '<button class="call-control-btn' + (state.isSharingScreen ? ' active' : '') + '" id="call-screen" title="Partilhar tela">🖥️</button>' +
                '<button class="call-control-btn danger" id="call-end" title="Desligar">📵</button>' +
                '</div>';
        }
        
        overlay.appendChild(card);
        document.body.appendChild(overlay);
        
        if (type === 'calling') {
            document.getElementById('call-cancel')?.addEventListener('click', endCall);
        } else if (type === 'incoming') {
            document.getElementById('call-accept')?.addEventListener('click', acceptCall);
            document.getElementById('call-reject')?.addEventListener('click', rejectCall);
        } else if (type === 'connected') {
            document.getElementById('call-mute')?.addEventListener('click', toggleMute);
            document.getElementById('call-video')?.addEventListener('click', toggleVideo);
            document.getElementById('call-screen')?.addEventListener('click', toggleScreenShare);
            document.getElementById('call-end')?.addEventListener('click', endCall);
        }
    };

    const updateUI = () => {
        if (state.status !== 'connected') return;
        
        const muteBtn = document.getElementById('call-mute');
        if (muteBtn) muteBtn.className = 'call-control-btn' + (state.isMuted ? ' active' : '');
        
        const videoBtn = document.getElementById('call-video');
        if (videoBtn) videoBtn.className = 'call-control-btn' + (state.isVideoOff ? '' : ' active');
        
        const screenBtn = document.getElementById('call-screen');
        if (screenBtn) screenBtn.className = 'call-control-btn' + (state.isSharingScreen ? ' active' : '');
    };

    const hideUI = () => {
        const overlay = document.getElementById('call-overlay');
        if (overlay) overlay.remove();
    };

    // ============================================
    // INICIALIZAÇÃO
    // ============================================
    
    let initialized = false;
    
    const init = async () => {
        if (initialized) {
            log('⚠️', 'Sistema já inicializado, ignorando');
            return;
        }
        initialized = true;
        
        log('🚀', 'Inicializando sistema de chamadas');
        
        injectStyles();
        
        // Escutar evento de socket pronto
        window.addEventListener('voice-call-socket-ready', (e) => {
            log('📡', 'Socket pronto recebido via evento');
            socket = e.detail.socket;
            setupSocketListeners();
        });
        
        // Tentar obter socket existente
        const gotSocket = await ensureSocket();
        if (!gotSocket) {
            log('⚠️', 'Socket não disponível ainda, aguardando evento');
        }
        
        // Usar captura para garantir que este handler execute primeiro
        document.addEventListener('click', (e) => {
            const btn = e.target.closest('#voice-call-btn');
            if (!btn) return;
            
            // Impedir propagação e ação padrão imediatamente
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            
            const app = window.app;
            if (!app?.currentChannel || app.currentChannel.type !== 'dm') {
                alert('Chamadas só funcionam em conversas diretas');
                return;
            }
            
            const meId = String(app.currentUser?.id);
            const target = app.currentChannel.recipients?.find(r => String(r.id) !== meId);
            
            if (!target) {
                alert('Não foi possível encontrar o destinatário');
                return;
            }
            
            startCall(target.id, true);
        }, true); // capture phase
        
        log('✅', 'Sistema pronto');
    };

    // API pública
    window.LibertyCall = {
        startCall,
        endCall,
        acceptCall,
        rejectCall,
        toggleMute,
        toggleVideo,
        toggleScreenShare
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
