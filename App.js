import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  Vibration,
  StatusBar,
  Dimensions,
  Switch,
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

  const intervalRef = useRef(null);
  const countdownRef = useRef(null);
  const sounds = useRef({});

  useEffect(() => {
    async function loadSounds() {
      try {
        const { sound: start } = await Audio.Sound.createAsync(require('./assets/sounds/start.mp3'));
        const { sound: every2 } = await Audio.Sound.createAsync(require('./assets/sounds/every2.mp3'));
        const { sound: every5 } = await Audio.Sound.createAsync(require('./assets/sounds/every5.mp3'));
        const { sound: every10 } = await Audio.Sound.createAsync(require('./assets/sounds/every10.mp3'));
        const { sound: end } = await Audio.Sound.createAsync(require('./assets/sounds/end.mp3'));

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

  const playSound = async (type) => {
    try {
      const sound = sounds.current[type];
      if (sound) {
        await sound.replayAsync();
      }
    } catch (e) { }
  };

  const startCountdown = () => {
    setIsCountingDown(true);
    setCountdown(5);
    setIsFinished(false);

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
    await playSound('start');
    Vibration.vibrate(200);
  };

  const stopTimer = () => {
    clearInterval(intervalRef.current);
    clearInterval(countdownRef.current);
    setIsRunning(false);
    setIsCountingDown(false);
    setCountdown(5);
  };

  const resetTimer = () => {
    clearInterval(intervalRef.current);
    clearInterval(countdownRef.current);
    setIsRunning(false);
    setIsCountingDown(false);
    setRemaining(0);
    setIsFinished(false);
    setCountdown(5);
  };

  useEffect(() => {
    if (isRunning && remaining > 0) {
      intervalRef.current = setInterval(() => {
        setRemaining((prev) => {
          const next = prev - 1;
          const elapsed = totalSeconds - next;

          if (playEvery2 && next > 0 && elapsed % 120 === 0) {
            playSound('every2');
            Vibration.vibrate(150);
          }

          if (next > 0 && elapsed % 300 === 0) {
            playSound('every5');
            Vibration.vibrate([0, 200, 100, 200]);
          }

          if (next > 0 && elapsed % 600 === 0) {
            playSound('every10');
            Vibration.vibrate([0, 300, 100, 300]);
          }

          if (next <= 0) {
            clearInterval(intervalRef.current);
            setIsRunning(false);
            setIsFinished(true);
            playSound('end');
            Vibration.vibrate([0, 500, 200, 500]);
            return 0;
          }
          return next;
        });
      }, 1000);
    }

    return () => clearInterval(intervalRef.current);
  }, [isRunning, remaining, totalSeconds, playEvery2]);

  const formatTime = (sec) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const progress = totalSeconds > 0 ? remaining / totalSeconds : 1;
  const strokeDashoffset = CIRCUMFERENCE * (1 - progress);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0b1120" />

      <Text style={styles.title}>تایمر ورزش</Text>
      <Text style={styles.subtitle}>تمرکز کن، زمان رو بسپار به من</Text>

      <View style={styles.circleContainer}>
        <Svg width={SIZE} height={SIZE}>
          <Circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            stroke="#1e293b"
            strokeWidth={STROKE_WIDTH}
            fill="none"
          />
          <Circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            stroke={isFinished ? '#4ade80' : '#38bdf8'}
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
              <Text style={styles.countdownText}>صدا الان پخش می‌شود</Text>
              <Text style={styles.countdownNumber}>({countdown})</Text>
            </>
          ) : (
            <>
              <Text style={[styles.timer, isFinished && { color: '#4ade80' }]}>
                {formatTime(remaining)}
              </Text>
              {isRunning && <Text style={styles.runningText}>در حال اجرا...</Text>}
              {isFinished && <Text style={styles.finishedText}>آفرین! 💪</Text>}
            </>
          )}
        </View>
      </View>

      {!isRunning && !isCountingDown && remaining === 0 && !isFinished && (
        <View style={styles.settingsContainer}>
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>صدای هر ۲ دقیقه</Text>
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
              onChangeText={setMinutes}
              maxLength={3}
              placeholder="15"
              placeholderTextColor="#64748b"
            />
          </View>
        </View>
      )}

      <View style={styles.buttons}>
        {!isRunning && !isCountingDown ? (
          <TouchableOpacity style={styles.btnStart} onPress={startCountdown} activeOpacity={0.8}>
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
  container: {
    flex: 1,
    backgroundColor: '#0b1120',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#f1f5f9',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: '#94a3b8',
    marginBottom: 40,
  },
  circleContainer: {
    width: SIZE,
    height: SIZE,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 30,
  },
  timeContainer: {
    position: 'absolute',
    alignItems: 'center',
  },
  timer: {
    fontSize: 52,
    fontWeight: '300',
    color: '#38bdf8',
    fontVariant: ['tabular-nums'],
  },
  countdownText: {
    fontSize: 16,
    color: '#94a3b8',
    marginBottom: 8,
    textAlign: 'center',
  },
  countdownNumber: {
    fontSize: 64,
    fontWeight: '300',
    color: '#fbbf24',
  },
  runningText: {
    marginTop: 8,
    fontSize: 14,
    color: '#94a3b8',
  },
  finishedText: {
    marginTop: 8,
    fontSize: 16,
    color: '#4ade80',
    fontWeight: '600',
  },
  settingsContainer: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 20,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1e293b',
    width: '85%',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#334155',
  },
  switchLabel: {
    color: '#e2e8f0',
    fontSize: 16,
  },
  inputContainer: {
    alignItems: 'center',
  },
  label: {
    color: '#94a3b8',
    fontSize: 14,
    marginBottom: 10,
  },
  input: {
    backgroundColor: '#1e293b',
    color: '#f1f5f9',
    fontSize: 28,
    width: 110,
    textAlign: 'center',
    borderRadius: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  buttons: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 10,
  },
  btnStart: {
    backgroundColor: '#0ea5e9',
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 50,
    elevation: 4,
  },
  btnStop: {
    backgroundColor: '#ef4444',
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 50,
    elevation: 4,
  },
  btnReset: {
    backgroundColor: '#1e293b',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 50,
    borderWidth: 1,
    borderColor: '#334155',
  },
  btnText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
  },
  btnTextReset: {
    color: '#94a3b8',
    fontSize: 17,
    fontWeight: '500',
  },
});
