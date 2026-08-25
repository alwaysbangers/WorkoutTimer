import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet, Text, View, TextInput, TouchableOpacity, Vibration, StatusBar, Dimensions, Switch, Animated, Alert
} from 'react-native';
import { Audio } from 'expo-av';
import Svg, { Circle } from 'react-native-svg';

const { width } = Dimensions.get('window');
const SIZE = width * 0.65;
const STROKE_WIDTH = 14;
const RADIUS = (SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export default function App() {
  const [minutes, setMinutes] = useState('15');
  const [totalSeconds, setTotalSeconds] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [playEvery2, setPlayEvery2] = useState(true);
  const [isCountingDown, setIsCountingDown] = useState(false);
  const [countdown, setCountdown] = useState(5);
  const [warningType, setWarningType] = useState(null); // '2min', '5min', '10min', 'end', or null
  const [blockMessage, setBlockMessage] = useState('');

  const intervalRef = useRef(null);
  const countdownRef = useRef(null);
  const sounds = useRef({});
  const playedRef = useRef({}); // Prevents double-triggering of sounds
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // تنظیم حالت صوتی برای اطمینان از پخش صدا حتی در حالت سایلنت
  useEffect(() => {
    Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
    });
  }, []);

  // انیمیشن پالس (تپش) دایره
  useEffect(() => {
    let animation;
    if (warningType) {
      animation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.08, duration: 500, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
        ])
      );
      animation.start();
    } else {
      Animated.timing(pulseAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
      if (animation) animation.stop();
    }
    return () => { if (animation) animation.stop(); };
  }, [warningType]);

  // لود کردن صداها
  useEffect(() => {
    async function loadSounds() {
      try {
        const { sound: start } = await Audio.Sound.createAsync(require('./assets/sounds/start.mp3'), { shouldPlay: false });
        const { sound: every2 } = await Audio.Sound.createAsync(require('./assets/sounds/every2.mp3'), { shouldPlay: false });
        const { sound: every5 } = await Audio.Sound.createAsync(require('./assets/sounds/every5.mp3'), { shouldPlay: false });
        const { sound: every10 } = await Audio.Sound.createAsync(require('./assets/sounds/every10.mp3'), { shouldPlay: false });
        const { sound: end } = await Audio.Sound.createAsync(require('./assets/sounds/end.mp3'), { shouldPlay: false });

        sounds.current = { start, every2, every5, every10, end };
      } catch (e) {
        console.log('صداها لود نشدن', e);
      }
    }
    loadSounds();
    return () => {
      Object.values(sounds.current).forEach((s) => s?.unloadAsync());
    };
  }, []);

  // تابع پخش صدای دوبل (تضمینی)
  const playSoundTwice = async (type) => {
    try {
      const sound = sounds.current[type];
      if (!sound) return;

      let playCount = 0;
      const onPlaybackStatusUpdate = (status) => {
        if (status.isLoaded && status.didJustFinish) {
          playCount++;
          if (playCount < 2) {
            sound.replayAsync(); // پخش بار دوم
          } else {
            sound.setOnPlaybackStatusUpdate(null); // پاکسازی
          }
        }
      };

      sound.setOnPlaybackStatusUpdate(onPlaybackStatusUpdate);
      await sound.setPositionAsync(0);
      await sound.playAsync();
    } catch (e) {
      console.log('خطا در پخش صدا:', e);
    }
  };

  const startCountdown = () => {
    const mins = parseInt(minutes);
    if (mins < 15) {
      Alert.alert('خطا', 'زمان ورزش نمی‌تواند کمتر از ۱۵ دقیقه باشد.');
      return;
    }
    setIsCountingDown(true);
    setCountdown(5);
    setIsFinished(false);
    setWarningType(null);

    countdownRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(countdownRef.current);
          setIsCountingDown(false);
          actuallyStartTimer();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const actuallyStartTimer = async () => {
    const mins = parseInt(minutes) || 15;
    const total = mins * 60;
    setTotalSeconds(total);
    setRemaining(total);
    setIsRunning(true);
    playedRef.current = {}; // ریست کردن وضعیت پخش صداها
    await playSoundTwice('start');
    Vibration.vibrate(200);
  };

  const stopTimer = () => {
    clearInterval(intervalRef.current);
    clearInterval(countdownRef.current);
    setIsRunning(false);
    setIsCountingDown(false);
    setCountdown(5);
    setWarningType(null);
  };

  const resetTimer = () => {
    clearInterval(intervalRef.current);
    clearInterval(countdownRef.current);
    setIsRunning(false);
    setIsCountingDown(false);
    setRemaining(0);
    setIsFinished(false);
    setCountdown(5);
    setWarningType(null);
    setBlockMessage('');
  };

  // منطق اصلی تایمر و هشدارها
  useEffect(() => {
    if (isRunning && remaining > 0) {
      intervalRef.current = setInterval(() => {
        setRemaining((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(intervalRef.current);
  }, [isRunning]);

  // افکت جانبی برای بررسی شرایط پخش صدا و هشدارها در هر ثانیه
  useEffect(() => {
    if (!isRunning || remaining <= 0) return;

    const elapsed = totalSeconds - remaining;
    const blockElapsed = elapsed % 900; // زمان سپری شده در بلوک ۱۵ دقیقه‌ای فعلی (۰ تا ۸۹۹ ثانیه)
    const totalBlocks = Math.ceil(totalSeconds / 900);
    const currentBlock = Math.floor(elapsed / 900) + 1;
    
    // تعیین پیام نیمه اول/دوم
    if (totalBlocks > 1) {
      const isSecondHalf = currentBlock > (totalBlocks / 2);
      setBlockMessage(isSecondHalf ? 'نیمه دوم' : 'نیمه اول');
    } else {
      setBlockMessage('');
    }

    // ریست کردن وضعیت پخش در شروع هر بلوک ۱۵ دقیقه‌ای
    if (blockElapsed === 0) {
      playedRef.current = {};
    }

    // هشدار و پخش صدای ۲ دقیقه
    if (blockElapsed === 115 && !playedRef.current['warn2']) {
      playedRef.current['warn2'] = true;
      setWarningType('2min');
    }
    if (blockElapsed === 120 && playEvery2 && !playedRef.current['every2']) {
      playedRef.current['every2'] = true;
      setWarningType(null);
      playSoundTwice('every2');
      Vibration.vibrate(150);
    }

    // هشدار و پخش صدای ۵ دقیقه
    if (blockElapsed === 295 && !playedRef.current['warn5']) {
      playedRef.current['warn5'] = true;
      setWarningType('5min');
    }
    if (blockElapsed === 300 && !playedRef.current['every5']) {
      playedRef.current['every5'] = true;
      setWarningType(null);
      playSoundTwice('every5');
      Vibration.vibrate([0, 200, 100, 200]);
    }

    // هشدار و پخش صدای ۱۰ دقیقه
    if (blockElapsed === 595 && !playedRef.current['warn10']) {
      playedRef.current['warn10'] = true;
      setWarningType('10min');
    }
    if (blockElapsed === 600 && !playedRef.current['every10']) {
      playedRef.current['every10'] = true;
      setWarningType(null);
      playSoundTwice('every10');
      Vibration.vibrate([0, 300, 100, 300]);
    }

    // هشدار ۱۵ ثانیه‌ای قبل از پایان بلوک ۱۵ دقیقه‌ای (یا پایان کل تایمر)
    if (remaining <= 15 && !playedRef.current['warnEnd']) {
      playedRef.current['warnEnd'] = true;
      setWarningType('end');
    }

    // پایان بلوک ۱۵ دقیقه‌ای (یا پایان کل تایمر)
    if (remaining === 0 && !playedRef.current['end']) {
      playedRef.current['end'] = true;
      clearInterval(intervalRef.current);
      setIsRunning(false);
      setIsFinished(true);
      setWarningType(null);
      playSoundTwice('end');
      Vibration.vibrate([0, 500, 200, 500]);
    }
  }, [remaining, isRunning, totalSeconds, playEvery2]);

  const formatTime = (sec) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const progress = totalSeconds > 0 ? remaining / totalSeconds : 1;
  const strokeDashoffset = CIRCUMFERENCE * (1 - progress);
  const isValidTime = parseInt(minutes) >= 15;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0b1120" />

      <Text style={styles.title}>تایمر ورزش</Text>
      <Text style={styles.subtitle}>تمرکز کن، زمان رو بسپار به من</Text>

      <Animated.View style={[styles.circleContainer, { transform: [{ scale: pulseAnim }] }]}>
        <Svg width={SIZE} height={SIZE}>
          <Circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} stroke="#1e293b" strokeWidth={STROKE_WIDTH} fill="none" />
          <Circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            stroke={isFinished ? '#4ade80' : (warningType ? '#fbbf24' : '#38bdf8')}
            strokeWidth={STROKE_WIDTH}
            fill="none"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            rotation="-90"
            origin={`${SIZE / 2}, ${SIZE / 2}`}
          />
        </Svg>

        <View style={styles.timeContainer}>
          {isCountingDown ? (
            <>
              <Text style={styles.countdownText}>آماده‌باش</Text>
              <Text style={styles.countdownNumber}>({countdown})</Text>
            </>
          ) : (
            <>
              <Text style={[styles.timer, isFinished && { color: '#4ade80' }]}>
                {formatTime(remaining)}
              </Text>
              {blockMessage ? <Text style={styles.blockText}>{blockMessage}</Text> : null}
              {warningType === 'end' && remaining > 0 && (
                <Text style={styles.warningText}>⚠️ ۱۵ ثانیه تا پایان</Text>
              )}
              {warningType === '2min' && <Text style={styles.warningText}>⚠️ ۵ ثانیه تا ۲ دقیقه</Text>}
              {warningType === '5min' && <Text style={styles.warningText}>⚠️ ۵ ثانیه تا ۵ دقیقه</Text>}
              {warningType === '10min' && <Text style={styles.warningText}>⚠️ ۵ ثانیه تا ۱۰ دقیقه</Text>}
              
              {isRunning && !warningType && <Text style={styles.runningText}>در حال اجرا...</Text>}
              {isFinished && <Text style={styles.finishedText}>آفرین! 💪</Text>}
            </>
          )}
        </View>
      </Animated.View>

      {!isRunning && !isCountingDown && remaining === 0 && !isFinished && (
        <View style={styles.settingsContainer}>
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>یادآوری صوتی هر 2 دقیقه</Text>
            <Switch
              value={playEvery2}
              onValueChange={setPlayEvery2}
              trackColor={{ false: '#334155', true: '#0ea5e9' }}
              thumbColor={playEvery2 ? '#fff' : '#94a3b8'}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>مدت زمان (دقیقه)</Text>
            <TextInput
              style={styles.input}
              keyboardType="number-pad"
              value={minutes}
              onChangeText={(text) => {
                const numeric = text.replace(/[^0-9]/g, '');
                setMinutes(numeric);
              }}
              maxLength={3}
              placeholder="15"
              placeholderTextColor="#64748b"
            />
            {!isValidTime && minutes !== '' && (
              <Text style={styles.errorText}>زمان ورزش نمی‌تواند کمتر از ۱۵ دقیقه باشد</Text>
            )}
          </View>
        </View>
      )}

      <View style={styles.buttons}>
        {!isRunning && !isCountingDown ? (
          <TouchableOpacity 
            style={[styles.btnStart, !isValidTime && styles.btnDisabled]} 
            onPress={startCountdown} 
            activeOpacity={0.8}
            disabled={!isValidTime}
          >
            <Text style={styles.btnText}>شروع</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.btnStop} onPress={stopTimer} activeOpacity={0.8}>
            <Text style={styles.btnText}>توقف</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.btnReset} onPress={resetTimer} activeOpacity={0.8}>
          <Text style={styles.btnTextReset}>ریست</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b1120', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  title: { fontSize: 28, fontWeight: '700', color: '#f1f5f9', marginBottom: 6 },
  subtitle: { fontSize: 14, color: '#94a3b8', marginBottom: 40 },
  circleContainer: { width: SIZE, height: SIZE, justifyContent: 'center', alignItems: 'center', marginBottom: 30 },
  timeContainer: { position: 'absolute', alignItems: 'center' },
  timer: { fontSize: 52, fontWeight: '300', color: '#38bdf8', fontVariant: ['tabular-nums'] },
  blockText: { marginTop: 4, fontSize: 16, color: '#94a3b8', fontWeight: '600' },
  warningText: { marginTop: 8, fontSize: 16, color: '#fbbf24', fontWeight: '700', textAlign: 'center' },
  countdownText: { fontSize: 16, color: '#94a3b8', marginBottom: 8, textAlign: 'center' },
  countdownNumber: { fontSize: 64, fontWeight: '300', color: '#fbbf24' },
  runningText: { marginTop: 8, fontSize: 14, color: '#94a3b8' },
  finishedText: { marginTop: 8, fontSize: 16, color: '#4ade80', fontWeight: '600' },
  settingsContainer: { width: '100%', alignItems: 'center', marginBottom: 20 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#1e293b', width: '85%', paddingVertical: 14, paddingHorizontal: 20, borderRadius: 16, marginBottom: 20, borderWidth: 1, borderColor: '#334155' },
  switchLabel: { color: '#e2e8f0', fontSize: 16 },
  inputContainer: { alignItems: 'center' },
  label: { color: '#94a3b8', fontSize: 14, marginBottom: 10 },
  input: { backgroundColor: '#1e293b', color: '#f1f5f9', fontSize: 28, width: 110, textAlign: 'center', borderRadius: 16, paddingVertical: 12, borderWidth: 1, borderColor: '#334155' },
  errorText: { color: '#ef4444', fontSize: 13, marginTop: 8, textAlign: 'center' },
  buttons: { flexDirection: 'row', gap: 16, marginTop: 10 },
  btnStart: { backgroundColor: '#0ea5e9', paddingVertical: 16, paddingHorizontal: 48, borderRadius: 50, elevation: 4 },
  btnDisabled: { backgroundColor: '#475569', opacity: 0.7 },
  btnStop: { backgroundColor: '#ef4444', paddingVertical: 16, paddingHorizontal: 48, borderRadius: 50, elevation: 4 },
  btnReset: { backgroundColor: '#1e293b', paddingVertical: 16, paddingHorizontal: 32, borderRadius: 50, borderWidth: 1, borderColor: '#334155' },
  btnText: { color: '#fff', fontSize: 17, fontWeight: '600' },
  btnTextReset: { color: '#94a3b8', fontSize: 17, fontWeight: '500' },
});
