import { lazy, Suspense, useCallback, useState, useEffect } from 'react'
import { useEchoSyncController } from './hooks/useEchoSyncController.js'
import { ArtworkContext } from './components/Cover'
import { MembersContext } from './components/shared/MembersContext'
import { AudioRootContainer } from './components/player/AudioRoot.jsx'
import { Sidebar } from './components/shell/Sidebar.jsx'
import { ROLE_COPY } from './components/shared/roomRoles'
import { formatTime } from './lib/time'
import { AudioLines } from 'lucide-react'
import { StageBar } from './components/shell/StageBar.jsx'
import { ErrorBoundary } from './components/shell/ErrorBoundary.jsx'
import { HomeView } from './views/HomeView'
import { searchEverything, normalizeRoomCode } from './lib/appServices.js'
import { PlayerDock } from './components/player/PlayerDock'
import { MobileMiniPlayer, MobileBottomBar } from './components/MobileBottomBar'
import { QueueDrawer } from './components/player/QueueDrawer'
import { InviteBanner } from './components/shell/InviteBanner.jsx'
import { RoleRequestPopup } from './components/shell/RoleRequestPopup.jsx'
import { Toast } from './components/shell/Toast.jsx'

const RoomsView = lazy(() => import('./views/RoomsView').then(module => ({ default: module.RoomsView })))
const LibraryView = lazy(() => import('./views/LibraryView').then(module => ({ default: module.LibraryView })))
const RoomView = lazy(() => import('./views/RoomView').then(module => ({ default: module.RoomView })))
const ChatPanel = lazy(() => import('./components/social/ChatDrawer').then(module => ({ default: module.ChatDrawer })))
const PublicLoungeDrawer = lazy(() => import('./components/social/PublicLoungeDrawer').then(module => ({ default: module.PublicLoungeDrawer })))
const LoungeUserCard = lazy(() => import('./components/social/LoungeUserCard.jsx').then(module => ({ default: module.LoungeUserCard })))
const SearchOverlay = lazy(() => import('./components/SearchOverlay').then(module => ({ default: module.SearchOverlay })))
const FullPlayer = lazy(() => import('./components/player/FullScreenPlayer').then(module => ({ default: module.FullScreenPlayer })))
const TasteModal = lazy(() => import('./components/modals/TasteModal.jsx').then(module => ({ default: module.TasteModal })))
const SettingsModal = lazy(() => import('./components/modals/SettingsModal.jsx').then(module => ({ default: module.SettingsModal })))
const MembersModal = lazy(() => import('./components/modals/MembersModal.jsx').then(module => ({ default: module.MembersModal })))
const RoomModal = lazy(() => import('./components/modals/RoomModal.jsx').then(module => ({ default: module.RoomModal })))
const JoinRoomModal = lazy(() => import('./components/modals/JoinRoomModal.jsx').then(module => ({ default: module.JoinRoomModal })))
const PasscodeModal = lazy(() => import('./components/modals/PasscodeModal.jsx').then(module => ({ default: module.PasscodeModal })))
const AuthModal = lazy(() => import('./components/modals/AuthModal.jsx').then(module => ({ default: module.AuthModal })))
const PlaylistModal = lazy(() => import('./components/modals/PlaylistModal.jsx').then(module => ({ default: module.PlaylistModal })))
const AddToPlaylistModal = lazy(() => import('./components/modals/AddToPlaylistModal.jsx').then(module => ({ default: module.AddToPlaylistModal })))

export default function App() {
  const [searchQuery, setSearchQuery] = useState('')
  const {
    startRoomTrack, queueSoloTrack, startTasteRadio, queueFilter, setQueueFilter, sleepTimer, setSleepTimer,
    artworkContextValue,
    memberIndex,
    theme,
    rootStyle,
    audioRef,
    ytContainerRef,
    track,
    handleTimeUpdate,
    handleLoadedMetadata,
    handleAudioReady,
    handleAudioBuffering,
    handleEnded,
    handleAudioError,
    shellDrawerOpen,
    displayRoom,
    rooms,
    view,
    roomPlaybackActive,
    role,
    likedSet,
    library,
    currentUser,
    playlists,
    navigateView,
    openSearchExperience,
    joinRoom,
    requestJoinCode,
    copyInvite,
    requestCreateRoom,
    openProfile,
    openCreatePlaylist,
    openPlaylist,
    leaveRoom,
    unreadRoomCounts,
    latestRoomPreview,
    loungeOpen,
    loungeUnreadCount,
    latestLoungePreview,
    openLounge,
    sidebarOpen,
    setSidebarOpen,
    joinPill,
    inRoom,
    acceptJoin,
    chatOpen,
    activeRoomUnread,
    setTheme,
    setChatOpen,
    openAuth,
    closeLounge,
    activeRoom,
    activePlaylistId,
    recent,
    dailyFeed,
    dailyStatus,
    tasteProfile,
    setTasteOpen,
    refreshDailyFeed,
    playSoloTrack,
    playPlaylist,
    toggleLike,
    requestAddToPlaylist,
    setActivePlaylistId,
    addTrackToPlaylist,
    openEditPlaylist,
    deletePlaylist,
    removeTrackFromPlaylist,
    shufflePlaylist,
    importPlaylistToRoom,
    queue,
    currentIndex,
    isPlaying,
    duration,
    canControl,
    volume,
    muted,
    pendingRequest,
    requestRole,
    resolveRoleRequest,
    setMembersOpen,
    requestEditRoom,
    findFullVersion,
    lockToast,
    togglePlay,
    nextTrack,
    previousTrack,
    seekTo,
    handleVolume,
    setMuted,
    playIndex,
    setFullPlayer,
    canControlRoom,
    removeRoomQueueTrack,
    clearRoomQueue,
    buffering,
    streamRecovering,
    toggleQueuePanel,
    cycleRepeatMode,
    toggleShuffleMode,
    repeatMode,
    shuffleEnabled,
    shellQueueOpen,
    activeTab,
    setLoungeOpen,
    setActiveTab,
    roomMessages,
    typingMemberId,
    draft,
    handleDraft,
    sendMessage,
    sendVoiceNote,
    setVoiceNotePlaying,
    reactToMessage,
    lyrics,
    setLyricsRefresh,
    deleteMessage,
    setReplyTo,
    replyTo,
    canModerate,
    translateOn,
    translating,
    toggleTranslation,
    micOn,
    micLevel,
    remoteSpeaking,
    voiceSpeaking,
    duckTest,
    toggleMic,
    runDuckTest,
    settings,
    setQueueOpen,
    reorderSoloQueue,
    removeSoloQueueTrack,
    clearSoloQueue,
    shuffleSoloQueue,
    loungeMessages,
    loungeTypingMember,
    loungeDraft,
    handleLoungeDraft,
    sendLoungeMessage,
    sendLoungeVoiceNote,
    setLoungeVoicePlaying,
    reactToLoungeMessage,
    deleteLoungeMessage,
    setLoungeReplyTo,
    loungeReplyTo,
    openRoomChat,
    inviteLoungeUser,
    loungeInvitingId,
    queueOpen,
    pendingInvite,
    resolveInvite,
    moderatorRequest,
    searchOpen,
    closeSearchExperience,
    playSearchTrack,
    queueSearchTrack,
    searchSuggestions,
    recentSearches,
    recordSearchQuery,
    removeRecentSearch,
    clearRecentSearches,
    searchTasteTracks,
    searchContext,
    pendingPlayId,
    fullPlayer,
    tasteOpen,
    saveTasteVibes,
    settingsOpen,
    cacheInfo,
    currentUserId,
    setSettingsOpen,
    saveProfile,
    saveUserSettings,
    clearAllCaches,
    signOut,
    membersOpen,
    publicUsers,
    inviteUser,
    showToast,
    kickMember,
    assignRole,
    roomEditor,
    setRoomEditor,
    updateRoom,
    deleteRoom,
    createRoom,
    joinRoomOpen,
    setJoinRoomOpen,
    joinRoomByCode,
    passcodeRoomId,
    setPasscodeRoomId,
    unlockPrivateRoom,
    authOpen,
    authMode,
    authReason,
    authNotice,
    pendingRoomCode,
    setAuthOpen,
    pendingAuthActionRef,
    setAuthReason,
    setAuthNotice,
    setAuthMode,
    signIn,
    signUp,
    playlistDialog,
    setPlaylistDialog,
    setPendingPlaylistTrack,
    submitPlaylist,
    addTrack,
    setAddTrack,
    toast,
  } = useEchoSyncController()

  useEffect(() => { if (searchOpen) document.getElementById('canonical-search-input')?.focus() }, [searchOpen])
  const openTaste = useCallback(() => setTasteOpen(true), [setTasteOpen])
  const createPlaylist = useCallback(() => openCreatePlaylist(), [openCreatePlaylist])
  const openFullPlayer = useCallback(() => setFullPlayer(true), [setFullPlayer])
  const toggleMute = useCallback(() => setMuted(value => !value), [setMuted])
  const closeQueue = useCallback(() => setQueueOpen(false), [setQueueOpen])

  return (
    <ArtworkContext.Provider value={artworkContextValue}>
    <MembersContext.Provider value={memberIndex}>
      <div className={`app ${theme}`} style={rootStyle}>
        <div className="ambient" />
        <AudioRootContainer
          audioRef={audioRef}
          containerRef={ytContainerRef}
          trackId={track?.id}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onCanPlay={handleAudioReady}
          onPlaying={handleAudioReady}
          onWaiting={handleAudioBuffering}
          onStalled={handleAudioBuffering}
          onEnded={handleEnded}
          onError={handleAudioError}
        />

        <div className={`shell ${shellDrawerOpen ? '' : 'chat-collapsed'}`}>
          <Sidebar
            room={displayRoom}
            rooms={rooms}
            view={view}
            inRoom={roomPlaybackActive}
            role={ROLE_COPY[role]?.label || 'Listener'}
            likedCount={likedSet.filter((id) => library[id]).length}
            currentUser={currentUser}
            playlists={playlists}
            onNavigate={navigateView}
            onSearch={openSearchExperience}
            onJoinRoom={joinRoom}
            onJoinCode={requestJoinCode}
            onInvite={copyInvite}
            onCreateRoom={requestCreateRoom}
            onOpenProfile={openProfile}
            onCreatePlaylist={createPlaylist}
            onOpenPlaylist={openPlaylist}
            onLeaveRoom={leaveRoom}
            unreadRoomCounts={unreadRoomCounts}
            latestRoomPreview={latestRoomPreview}
            loungeOpen={loungeOpen}
            unreadLoungeCount={loungeUnreadCount}
            latestLoungePreview={latestLoungePreview}
            onOpenLounge={openLounge}
            mobileOpen={sidebarOpen}
            onMobileClose={() => setSidebarOpen(false)}
          />

          <main className="stage">
            {joinPill && inRoom && (
              <button className="join-live-pill" onClick={acceptJoin}>
                <span className="join-live-dot" />
                <span>
                  <small>LIVE ROOM PLAYING AT {formatTime(joinPill.time)}</small>
                  <strong>Tap to sync audio immediately</strong>
                </span>
                <AudioLines size={16} />
              </button>
            )}
            <StageBar searchQuery={searchQuery} onSearchQuery={setSearchQuery} searchOpen={searchOpen}
              room={displayRoom}
              view={view}
              inRoom={roomPlaybackActive}
              theme={theme}
              currentUser={currentUser}
              chatOpen={chatOpen}
              unreadCount={activeRoomUnread}
              onOpenProfile={openProfile}
              onToggleTheme={() => setTheme((value) => (value === 'dark' ? 'light' : 'dark'))}
              onSearch={openSearchExperience}
              onToggleChat={() => setChatOpen((value) => !value)}
              onHome={() => navigateView('home')}
              onLogin={() => openAuth('signin')}
              onSignUp={() => openAuth('signup')}
              onOpenSidebar={() => setSidebarOpen(true)}
              loungeOpen={loungeOpen}
              unreadLoungeCount={loungeUnreadCount}
              onToggleLounge={() => (loungeOpen ? closeLounge() : openLounge())}
            />

            <ErrorBoundary resetKey={`${view}:${activeRoom?.id || ''}:${activePlaylistId || ''}`}>
              <div className="stage-scroll">
                {view === 'home' && (
                <HomeView onQueue={queueSoloTrack} onStartRadio={startTasteRadio}
                  currentUser={currentUser}
                  library={library}
                  liked={likedSet}
                  recentIds={recent}
                  playlists={playlists}
                  dailyFeed={dailyFeed}
                  dailyStatus={dailyStatus}
                  tasteProfile={tasteProfile}
                  onOpenTaste={openTaste}
                  onRefreshDaily={refreshDailyFeed}
                  roomCount={rooms.length}
                  onPlayTrack={playSoloTrack}
                  onPlayPlaylist={playPlaylist}
                  onLike={toggleLike}
                  onAddToPlaylist={requestAddToPlaylist}
                  onSearch={openSearchExperience}
                  onCreatePlaylist={createPlaylist}
                  onOpenPlaylist={openPlaylist}
                  onCreateRoom={requestCreateRoom}
                  onJoinCode={requestJoinCode}
                />
              )}

              {view === 'rooms' && (
                <Suspense fallback={<div className="surface-loading" role="status">Loading…</div>}> <RoomsView
                  rooms={rooms}
                  library={library}
                  currentRoom={activeRoom}
                  onJoin={joinRoom}
                  onCreate={requestCreateRoom}
                  onJoinCode={requestJoinCode}
                /> </Suspense>
              )}

              {view === 'library' && (
                <Suspense fallback={<div className="surface-loading" role="status">Loading…</div>}> <LibraryView
                  searchTracks={searchEverything}
                  library={library}
                  liked={likedSet}
                  recentIds={recent}
                  playlists={playlists}
                  currentUser={currentUser}
                  activePlaylistId={activePlaylistId}
                  onSelectPlaylist={setActivePlaylistId}
                  onPlay={playSoloTrack}
                  onLike={toggleLike}
                  onAddToPlaylist={requestAddToPlaylist}
                  onAddToActivePlaylist={(candidate) => {
                    if (!activePlaylistId) return
                    addTrackToPlaylist(activePlaylistId, candidate)
                  }}
                  onSearch={openSearchExperience}
                  onCreatePlaylist={createPlaylist}
                  onPlayPlaylist={playPlaylist}
                  onRenamePlaylist={openEditPlaylist}
                  onDeletePlaylist={deletePlaylist}
                  onRemoveFromPlaylist={removeTrackFromPlaylist}
                  onShufflePlaylist={shufflePlaylist}
                  onOpenPlaylist={openPlaylist}
                  onImportPlaylist={importPlaylistToRoom}
                /> </Suspense>
              )}

              {view === 'room' && activeRoom && (
                <Suspense fallback={<div className="surface-loading" role="status">Loading…</div>}> <RoomView starterTracks={searchTasteTracks} onStartTrack={startRoomTrack} onResync={acceptJoin}
                  room={activeRoom}
                  track={track}
                  queue={queue}
                  currentIndex={currentIndex}
                  isPlaying={isPlaying}
                  duration={duration}
                  canControl={canControl}
                  role={role}
                  volume={volume}
                  muted={muted}
                  liked={likedSet}
                  currentUser={currentUser}
                  pendingRequest={pendingRequest}
                  roleRequests={activeRoom.requests || []}
                  onRequestRole={requestRole}
                  onResolveRequest={resolveRoleRequest}
                  onOpenMembers={() => setMembersOpen(true)}
                  onOpenSettings={requestEditRoom}
                  onFindFull={findFullVersion}
                  onRetryFull={findFullVersion}
                  onLeaveRoom={leaveRoom}
                  onLock={lockToast}
                  onTogglePlay={togglePlay}
                  onNext={nextTrack}
                  onPrev={previousTrack}
                  onSeek={seekTo}
                  onVolume={handleVolume}
                  onToggleMute={toggleMute}
                  onLike={toggleLike}
                  onAddToPlaylist={requestAddToPlaylist}
                  onInvite={() => setMembersOpen(true)}
                  onSearch={openSearchExperience}
                  onPlayIndex={playIndex}
                  onOpenFull={openFullPlayer}
                  playlists={playlists}
                  likedTracks={likedSet.map((id) => library[id]).filter(Boolean)}
                  canControlRoom={canControlRoom}
                  onRemoveQueueTrack={removeRoomQueueTrack}
                  onClearQueue={clearRoomQueue}
                  onImportPlaylist={importPlaylistToRoom}
                /> </Suspense>
              )}
              </div>
            </ErrorBoundary>

            <ErrorBoundary resetKey="player-dock">
              <PlayerDock
                sleepTimer={sleepTimer} onSleepTimer={setSleepTimer}
                track={track}
                inRoom={roomPlaybackActive}
                isPlaying={isPlaying}
                buffering={buffering || streamRecovering}
                duration={duration}
                liked={likedSet}
                volume={volume}
                muted={muted}
                onTogglePlay={togglePlay}
                onPrev={previousTrack}
                onNext={nextTrack}
                onLike={toggleLike}
                onAddToPlaylist={requestAddToPlaylist}
                onVolume={handleVolume}
                onToggleMute={toggleMute}
                onSeek={seekTo}
                canSeek={canControl}
                onOpenFull={openFullPlayer}
                onToggleQueue={toggleQueuePanel}
                onCycleRepeat={cycleRepeatMode}
                onToggleShuffle={toggleShuffleMode}
                repeatMode={repeatMode}
                shuffleEnabled={shuffleEnabled}
                queueCount={Math.max(0, queue.length - currentIndex - 1)}
                queueOpen={shellQueueOpen}
              />
            </ErrorBoundary>

            <MobileMiniPlayer
              track={track}
              isPlaying={isPlaying}
              buffering={buffering || streamRecovering}
              duration={duration}
              liked={likedSet}
              onTogglePlay={togglePlay}
              onLike={toggleLike}
              onOpenFull={openFullPlayer}
            />
            <MobileBottomBar
              view={view}
              inRoom={roomPlaybackActive}
              chatOpen={chatOpen}
              loungeOpen={loungeOpen}
              unreadLoungeCount={loungeUnreadCount}
              unreadRoomCount={activeRoomUnread}
              likedCount={likedSet.length}
              onNavigate={navigateView}
              onSearch={openSearchExperience}
              onLounge={openLounge}
            />
          </main>

          {inRoom && view === 'room' && !loungeOpen && (
            <Suspense fallback={<div className="surface-loading" role="status">Loading…</div>}> <ChatPanel
              room={activeRoom}
              activeTab={activeTab}
              onTab={(tab) => {
                setLoungeOpen(false)
                setActiveTab(tab)
              }}
              messages={roomMessages}
              typingMemberId={typingMemberId}
              draft={draft}
              onDraft={handleDraft}
              onSend={sendMessage}
              onSendVoice={sendVoiceNote}
              onVoiceNotePlay={setVoiceNotePlaying}
              onReact={reactToMessage}
              onClose={() => setChatOpen(false)}
              track={track}
              lyrics={lyrics}
              canControl={canControl}
              onSeek={seekTo}
              onLock={lockToast}
              onRetryLyrics={() => setLyricsRefresh((value) => value + 1)}
              onDeleteMessage={deleteMessage}
              onReply={(message) => {
                const author = memberIndex[message.author] || {}
                setReplyTo({
                  id: message.id,
                  name: author.name || 'Listener',
                  handle: author.handle || 'listener',
                  text: message.type === 'voice' ? 'Voice note' : message.text,
                })
              }}
              replyTo={replyTo}
              onCancelReply={() => setReplyTo(null)}
              currentUser={currentUser}
              canModerate={canModerate}
              memberRoles={activeRoom.roles || {}}
              translateOn={translateOn}
              translating={translating}
              onToggleTranslate={toggleTranslation}
              micOn={micOn}
              micLevel={micOn ? micLevel : remoteSpeaking ? 0.62 : 0}
              speaking={voiceSpeaking}
              duckTest={duckTest}
              onToggleMic={toggleMic}
              onDuckTest={runDuckTest}
              duckLevel={settings.duckLevel}
              open={chatOpen}
              onOpenLounge={openLounge}
              unreadLoungeCount={loungeUnreadCount}
            /> </Suspense>
          )}
          {shellQueueOpen && (
            <QueueDrawer
              filterMode={queueFilter} onFilter={setQueueFilter} liked={likedSet} recent={recent} tasteProfile={tasteProfile}
              queue={queue}
              currentIndex={currentIndex}
              track={track}
              isPlaying={isPlaying}
              onClose={closeQueue}
              onPlayIndex={playIndex}
              onMove={reorderSoloQueue}
              onRemove={removeSoloQueueTrack}
              onClear={clearSoloQueue}
              onShuffle={shuffleSoloQueue}
            />
          )}
          {loungeOpen && (
            <Suspense fallback={<div className="surface-loading" role="status">Loading…</div>}> <PublicLoungeDrawer
              open={loungeOpen}
              messages={loungeMessages}
              currentUser={currentUser}
              members={memberIndex}
              typingMember={loungeTypingMember}
              room={inRoom && view === 'room' ? activeRoom : null}
              inRoom={inRoom && view === 'room'}
              draft={loungeDraft}
              onDraft={handleLoungeDraft}
              onSend={sendLoungeMessage}
              onSendVoice={sendLoungeVoiceNote}
              onVoiceNotePlay={setLoungeVoicePlaying}
              onReact={reactToLoungeMessage}
              onDelete={deleteLoungeMessage}
              onReply={(message, author) => {
                setLoungeReplyTo({
                  id: message.id,
                  name: author.name || 'Listener',
                  handle: author.handle || 'listener',
                  text: message.type === 'voice' ? 'Voice note' : message.text,
                })
              }}
              replyTo={loungeReplyTo}
              onCancelReply={() => setLoungeReplyTo(null)}
              onClose={closeLounge}
              onOpenRoomChat={openRoomChat}
              onInviteUser={inviteLoungeUser}
              invitingId={loungeInvitingId}
              onLogin={() => openAuth('signin', 'Log in to join the Public Lounge conversation.')}
              UserCard={LoungeUserCard}
            /> </Suspense>
          )}
          {shellDrawerOpen && (
            <div
              className="chat-scrim"
              onClick={() => {
                if (loungeOpen) closeLounge()
                if (chatOpen) setChatOpen(false)
                if (queueOpen) setQueueOpen(false)
              }}
            />
          )}
        </div>

        <ErrorBoundary resetKey="overlays">
          {pendingInvite && (
            <InviteBanner
              invite={pendingInvite}
              onAccept={() => resolveInvite(pendingInvite.id, true)}
              onDecline={() => resolveInvite(pendingInvite.id, false)}
            />
          )}

        {moderatorRequest && activeRoom && (
          <RoleRequestPopup
            request={moderatorRequest}
            requester={memberIndex[moderatorRequest.userId]}
            roomName={activeRoom.name}
            onApprove={() => resolveRoleRequest(moderatorRequest.id, true)}
            onDecline={() => resolveRoleRequest(moderatorRequest.id, false)}
          />
        )}

        {searchOpen && (
          <Suspense fallback={<div className="surface-loading" role="status">Loading…</div>}> <SearchOverlay
            query={searchQuery} onQueryChange={setSearchQuery} liked={likedSet} onLike={toggleLike}
            onClose={closeSearchExperience}
            onPlay={playSearchTrack}
            onQueue={queueSearchTrack}
            onAddToPlaylist={requestAddToPlaylist}
            onSearch={searchEverything}
            suggestions={searchSuggestions}
            recentSearches={recentSearches}
            onSearchCommit={recordSearchQuery}
            onRemoveRecentSearch={removeRecentSearch}
            onClearRecentSearches={clearRecentSearches}
            tasteTracks={searchTasteTracks}
            context={searchContext}
            canControlRoom={canControlRoom}
            pendingTrackId={pendingPlayId}
            onOpenTaste={() => {
              closeSearchExperience()
              setTasteOpen(true)
            }}
          /> </Suspense>
        )}

        {fullPlayer && (
          <Suspense fallback={<div className="surface-loading" role="status">Loading…</div>}> <FullPlayer
            sleepTimer={sleepTimer} onSleepTimer={setSleepTimer}
            room={displayRoom}
            inRoom={roomPlaybackActive}
            track={track}
            queue={queue}
            isPlaying={isPlaying}
            buffering={buffering || streamRecovering}
            duration={duration}
            volume={volume}
            muted={muted}
            liked={likedSet}
            lyrics={lyrics}
            canControl={canControl}
            onClose={() => setFullPlayer(false)}
            onTogglePlay={togglePlay}
            onPrev={previousTrack}
            onNext={nextTrack}
            onSeek={seekTo}
            onLock={lockToast}
            onLike={toggleLike}
            onAddToPlaylist={requestAddToPlaylist}
            onVolume={handleVolume}
            onToggleMute={toggleMute}
            onRetryLyrics={() => setLyricsRefresh((value) => value + 1)}
            onToggleQueue={toggleQueuePanel}
            onCycleRepeat={cycleRepeatMode}
            onToggleShuffle={toggleShuffleMode}
            repeatMode={repeatMode}
            shuffleEnabled={shuffleEnabled}
            queueCount={Math.max(0, queue.length - currentIndex - 1)}
            translateOn={translateOn}
            translating={translating}
            onToggleTranslate={toggleTranslation}
          /> </Suspense>
        )}

        {tasteOpen && (
          <Suspense fallback={<div className="surface-loading" role="status">Loading…</div>}> <TasteModal
            profile={tasteProfile}
            onClose={() => setTasteOpen(false)}
            onSave={saveTasteVibes}
          /> </Suspense>
        )}

        {settingsOpen && currentUser && (
          <Suspense fallback={<div className="surface-loading" role="status">Loading…</div>}> <SettingsModal
            user={currentUser}
            settings={settings}
            cacheInfo={cacheInfo}
            tasteProfile={tasteProfile}
            stats={{
              playlists: playlists.length,
              liked: likedSet.length,
              rooms: rooms.filter((room) => room.createdBy === currentUserId).length,
            }}
            onClose={() => setSettingsOpen(false)}
            onSaveProfile={saveProfile}
            onSaveSettings={saveUserSettings}
            onSaveTaste={saveTasteVibes}
            onClearCache={clearAllCaches}
            onSignOut={signOut}
          /> </Suspense>
        )}

        {membersOpen && activeRoom && (
          <Suspense fallback={<div className="surface-loading" role="status">Loading…</div>}> <MembersModal
            room={activeRoom}
            currentUserId={currentUserId}
            canModerate={canModerate}
            roles={activeRoom.roles || {}}
            members={memberIndex}
            users={publicUsers}
            requests={activeRoom.requests || []}
            onClose={() => setMembersOpen(false)}
            onInviteUser={inviteUser}
            onCopyLink={() => showToast('Invite link copied')}
            onKick={kickMember}
            onAssignRole={assignRole}
            onResolveRequest={resolveRoleRequest}
          /> </Suspense>
        )}

        {roomEditor === 'edit' && activeRoom && (
          <Suspense fallback={<div className="surface-loading" role="status">Loading…</div>}> <RoomModal starterTracks={searchTasteTracks}
            mode="edit"
            room={activeRoom}
            onClose={() => setRoomEditor(null)}
            onUpdate={updateRoom}
            onDelete={deleteRoom}
          /> </Suspense>
        )}

        {roomEditor === 'create' && (
          <Suspense fallback={<div className="surface-loading" role="status">Loading…</div>}> <RoomModal starterTracks={searchTasteTracks}
            mode="create"
            onClose={() => setRoomEditor(null)}
            onCreate={createRoom}
          /> </Suspense>
        )}

        {joinRoomOpen && currentUser && (
          <Suspense fallback={<div className="surface-loading" role="status">Loading…</div>}> <JoinRoomModal
            onClose={() => setJoinRoomOpen(false)}
            onJoin={joinRoomByCode}
          /> </Suspense>
        )}

        {passcodeRoomId && (
          <Suspense fallback={<div className="surface-loading" role="status">Loading…</div>}> <PasscodeModal
            room={rooms.find((room) => room.id === passcodeRoomId)}
            onClose={() => setPasscodeRoomId(null)}
            onUnlock={unlockPrivateRoom}
          /> </Suspense>
        )}

        {authOpen && (
          <Suspense fallback={<div className="surface-loading" role="status">Loading…</div>}> <AuthModal
            mode={authMode}
            reason={authReason}
            notice={authNotice}
            pendingRoom={pendingRoomCode ? normalizeRoomCode(pendingRoomCode) : ''}
            onClose={() => {
              setAuthOpen(false)
              pendingAuthActionRef.current = null
              setAuthReason('')
              setAuthNotice('')
            }}
            onSwitch={(mode) => {
              setAuthMode(mode)
              setAuthReason('')
              setAuthNotice('')
            }}
            onSignIn={signIn}
            onSignUp={signUp}
          /> </Suspense>
        )}

        {playlistDialog && (
          <Suspense fallback={<div className="surface-loading" role="status">Loading…</div>}> <PlaylistModal
            mode={playlistDialog.mode}
            playlist={playlistDialog.playlist}
            onClose={() => {
              setPlaylistDialog(null)
              setPendingPlaylistTrack(null)
            }}
            onSubmit={submitPlaylist}
          /> </Suspense>
        )}

          {addTrack && (
            <Suspense fallback={<div className="surface-loading" role="status">Loading…</div>}> <AddToPlaylistModal
              track={addTrack}
              playlists={playlists}
              onClose={() => setAddTrack(null)}
              onAdd={(playlistId) => addTrackToPlaylist(playlistId, addTrack)}
              onCreate={(candidate) => {
                setAddTrack(null)
                openCreatePlaylist(candidate)
              }}
            /> </Suspense>
          )}
        </ErrorBoundary>

        <Toast toast={toast} />
      </div>
    </MembersContext.Provider>
    </ArtworkContext.Provider>
  )
}
