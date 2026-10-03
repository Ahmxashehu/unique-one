package com.uniqueone.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.MediaPlayer;
import android.media.session.MediaSession;
import android.os.Build;
import android.os.IBinder;

import org.json.JSONArray;
import java.util.ArrayList;

public class MediaPlaybackService extends Service {
    public static final String ACTION_PLAY="com.uniqueone.app.PLAY", ACTION_PAUSE="com.uniqueone.app.PAUSE", ACTION_RESUME="com.uniqueone.app.RESUME", ACTION_STOP="com.uniqueone.app.STOP";
    public static final String EXTRA_URIS="uris", EXTRA_NAMES="names", EXTRA_INDEX="index";
    private static final String CHANNEL="unique_media_playback";
    private final ArrayList<String> uris=new ArrayList<>(), names=new ArrayList<>();
    private int index=0;
    private MediaPlayer player;
    private MediaSession session;

    @Override public void onCreate() {
        super.onCreate(); createChannel();
        session=new MediaSession(this,"UniqueMedia");
        session.setCallback(new MediaSession.Callback(){
            @Override public void onPlay(){resumePlayback();}
            @Override public void onPause(){pausePlayback();}
            @Override public void onSkipToNext(){playIndex(index+1);}
            @Override public void onSkipToPrevious(){playIndex(Math.max(0,index-1));}
            @Override public void onStop(){stopPlayback();}
        });
        session.setActive(true);
    }

    @Override public int onStartCommand(Intent intent,int flags,int startId){
        if(intent==null)return START_STICKY;
        try{
            String action=intent.getAction();
            if(ACTION_PLAY.equals(action)){
                JSONArray iu=new JSONArray(intent.getStringExtra(EXTRA_URIS)), in=new JSONArray(intent.getStringExtra(EXTRA_NAMES));
                uris.clear(); names.clear();
                for(int i=0;i<iu.length();i++)uris.add(iu.getString(i));
                for(int i=0;i<in.length();i++)names.add(in.getString(i));
                index=Math.max(0,Math.min(intent.getIntExtra(EXTRA_INDEX,0),uris.size()-1));
                startForeground(21,notification("Playing "+currentName())); playCurrent();
            }else if(ACTION_PAUSE.equals(action))pausePlayback();
            else if(ACTION_RESUME.equals(action))resumePlayback();
            else if(ACTION_STOP.equals(action))stopPlayback();
        }catch(Exception ignored){}
        return START_STICKY;
    }

    private String currentName(){return index>=0&&index<names.size()?names.get(index):"UniqueMedia";}
    private void playCurrent(){
        releasePlayer();
        if(index<0||index>=uris.size()){stopPlayback();return;}
        try{
            player=new MediaPlayer();
            player.setAudioAttributes(new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_MEDIA).setContentType(AudioAttributes.CONTENT_TYPE_MUSIC).build());
            player.setDataSource(this,android.net.Uri.parse(uris.get(index)));
            player.setOnPreparedListener(mp->{mp.start();updateSession();updateNotification();});
            player.setOnCompletionListener(mp->{if(index+1<uris.size())playIndex(index+1);else stopPlayback();});
            player.prepareAsync();
        }catch(Exception ignored){updateNotification();}
    }
    private void playIndex(int next){if(next<0||next>=uris.size())return;index=next;startForeground(21,notification("Playing "+currentName()));playCurrent();}
    private void pausePlayback(){if(player!=null&&player.isPlaying())player.pause();updateSession();updateNotification();}
    private void resumePlayback(){if(player!=null){player.start();updateSession();updateNotification();}else playCurrent();}
    private void updateSession(){
        if(session==null)return;
        long actions=android.media.session.PlaybackState.ACTION_PLAY|android.media.session.PlaybackState.ACTION_PAUSE|android.media.session.PlaybackState.ACTION_SKIP_TO_NEXT|android.media.session.PlaybackState.ACTION_SKIP_TO_PREVIOUS|android.media.session.PlaybackState.ACTION_STOP;
        int state=player!=null&&player.isPlaying()?android.media.session.PlaybackState.STATE_PLAYING:android.media.session.PlaybackState.STATE_PAUSED;
        session.setPlaybackState(new android.media.session.PlaybackState.Builder().setActions(actions).setState(state,player==null?0:player.getCurrentPosition(),1f).build());
    }
    private void updateNotification(){NotificationManager n=(NotificationManager)getSystemService(NOTIFICATION_SERVICE);if(n!=null)n.notify(21,notification("Playing "+currentName()));}
    private Notification notification(String text){
        Intent open=new Intent(this,MainActivity.class);
        PendingIntent pi=PendingIntent.getActivity(this,0,open,PendingIntent.FLAG_UPDATE_CURRENT|(Build.VERSION.SDK_INT>=23?PendingIntent.FLAG_IMMUTABLE:0));
        Notification.Builder b=Build.VERSION.SDK_INT>=26?new Notification.Builder(this,CHANNEL):new Notification.Builder(this);
        return b.setContentTitle("UniqueMedia").setContentText(text).setSmallIcon(com.uniqueone.app.R.drawable.up_icon).setContentIntent(pi).setOngoing(player!=null&&player.isPlaying()).setCategory(Notification.CATEGORY_TRANSPORT).build();
    }
    private void releasePlayer(){if(player!=null){try{player.release();}catch(Exception ignored){}player=null;}}
    private void stopPlayback(){releasePlayer();if(session!=null)session.setActive(false);stopForeground(true);stopSelf();}
    private void createChannel(){if(Build.VERSION.SDK_INT>=26){NotificationChannel c=new NotificationChannel(CHANNEL,"UniqueMedia playback",NotificationManager.IMPORTANCE_LOW);c.setDescription("Background audio controls for UniqueMedia");((NotificationManager)getSystemService(NOTIFICATION_SERVICE)).createNotificationChannel(c);}}
    @Override public void onDestroy(){releasePlayer();if(session!=null)session.release();super.onDestroy();}
    @Override public IBinder onBind(Intent intent){return null;}
}