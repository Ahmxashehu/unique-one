package com.uniqueone.mobile

import android.content.Intent
import android.net.Uri
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.session.MediaSession
import androidx.media3.session.MediaSessionService

class MediaPlaybackService : MediaSessionService() {
    private var player: ExoPlayer? = null
    private var session: MediaSession? = null

    override fun onCreate() {
        super.onCreate()
        val exoPlayer = ExoPlayer.Builder(this).setHandleAudioBecomingNoisy(true).build()
        player = exoPlayer
        session = MediaSession.Builder(this, exoPlayer).build()
    }

    override fun onGetSession(controllerInfo: MediaSession.ControllerInfo): MediaSession? = session

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_PLAY_QUEUE -> {
                val uris = intent.getStringArrayListExtra(EXTRA_URIS) ?: arrayListOf()
                val titles = intent.getStringArrayListExtra(EXTRA_TITLES) ?: arrayListOf()
                val exoPlayer = player
                if (exoPlayer != null && uris.isNotEmpty()) {
                    val items = uris.mapIndexed { index, uri ->
                        MediaItem.Builder()
                            .setMediaId(index.toString())
                            .setUri(Uri.parse(uri))
                            .setMediaMetadata(
                                MediaMetadata.Builder()
                                    .setTitle(titles.getOrNull(index) ?: "UniqueMedia")
                                    .setArtist("UniqueMedia")
                                    .build()
                            )
                            .build()
                    }
                    exoPlayer.setMediaItems(items, intent.getIntExtra(EXTRA_INDEX, 0).coerceIn(0, items.lastIndex), 0L)
                    exoPlayer.prepare()
                    exoPlayer.play()
                }
            }
            ACTION_PLAY -> player?.play()
            ACTION_PAUSE -> player?.pause()
            ACTION_NEXT -> player?.seekToNextMediaItem()
            ACTION_PREVIOUS -> player?.seekToPreviousMediaItem()
            ACTION_STOP -> {
                player?.stop()
                stopSelf()
            }
        }
        return START_STICKY
    }

    override fun onDestroy() {
        session?.release()
        player?.release()
        session = null
        player = null
        super.onDestroy()
    }

    companion object {
        const val ACTION_PLAY_QUEUE = "com.uniqueone.mobile.PLAY_QUEUE"
        const val ACTION_PLAY = "com.uniqueone.mobile.PLAY"
        const val ACTION_PAUSE = "com.uniqueone.mobile.PAUSE"
        const val ACTION_NEXT = "com.uniqueone.mobile.NEXT"
        const val ACTION_PREVIOUS = "com.uniqueone.mobile.PREVIOUS"
        const val ACTION_STOP = "com.uniqueone.mobile.STOP"
        const val EXTRA_URIS = "uris"
        const val EXTRA_TITLES = "titles"
        const val EXTRA_INDEX = "index"
    }
}
