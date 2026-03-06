/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Pill,
  ClipboardList,
  Bell, 
  ChevronRight, 
  Stethoscope, 
  Video, 
  ShieldCheck, 
  Activity, 
  Clock, 
  Scan, 
  Home, 
  MessageSquare, 
  User, 
  ArrowLeft, 
  Camera, 
  Send,
  Plus,
  Search,
  Bookmark,
  Settings,
  MoreVertical,
  Sparkles,
  BrainCircuit,
  Mic,
  X,
  Heart,
  Thermometer,
  Wind,
  Droplets,
  TrendingUp,
  Trash2,
  Edit
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { healthcareChat } from './services/gemini';
import { AreaChart, Area, ResponsiveContainer, YAxis, XAxis, Tooltip } from 'recharts';

// --- Mock Data ---
const VITALS_HISTORY = [
  { time: '08:00', hr: 72, bp: 120, o2: 98 },
  { time: '10:00', hr: 75, bp: 122, o2: 97 },
  { time: '12:00', hr: 68, bp: 118, o2: 99 },
  { time: '14:00', hr: 82, bp: 125, o2: 98 },
  { time: '16:00', hr: 74, bp: 121, o2: 98 },
  { time: '18:00', hr: 70, bp: 119, o2: 99 },
];

import { auth, db } from './firebase';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  updateProfile 
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp, query, collection, where, orderBy, onSnapshot, deleteDoc } from 'firebase/firestore';

// --- Types ---
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

const handleFirestoreError = (error: unknown, operationType: OperationType, path: string | null) => {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
};

type Screen = 'splash' | 'auth' | 'home' | 'chat' | 'medicine' | 'clinic' | 'scanner' | 'history' | 'profile' | 'reports' | 'settings';
type ChatMode = 'symptom' | 'normal';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'bot';
  timestamp: Date;
}

// --- Components ---

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: any }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      let errorMessage = "An unexpected clinical error occurred.";
      try {
        const parsed = JSON.parse(this.state.error.message);
        if (parsed.error && parsed.error.includes('Missing or insufficient permissions')) {
          errorMessage = "Access Denied: You do not have permission to perform this clinical operation.";
        }
      } catch (e) {
        // Not a JSON error
      }

      return (
        <div className="h-full w-full flex flex-col items-center justify-center p-8 text-center bg-red-50">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-6">
            <ShieldCheck className="w-8 h-8 text-red-600" />
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">System Alert</h2>
          <p className="text-sm text-slate-500 mb-8 max-w-[240px] leading-relaxed">
            {errorMessage}
          </p>
          <button 
            onClick={() => window.location.reload()}
            className="px-8 py-4 bg-red-600 text-white rounded-2xl font-bold text-xs uppercase tracking-widest shadow-lg shadow-red-500/20"
          >
            Restart System
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const SplashScreen = ({ onInitialize }: { onInitialize: () => void }) => (
  <div className="relative h-full w-full overflow-hidden bg-white atmosphere">
    <div className="absolute inset-0 z-0">
      <img 
        src="https://images.unsplash.com/photo-1516549655169-df83a0774514?auto=format&fit=crop&q=80&w=1000" 
        alt="AI Healthcare" 
        className="h-full w-full object-cover opacity-10"
        referrerPolicy="no-referrer"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-white via-white/20 to-transparent" />
    </div>
    
    <div className="absolute inset-0 flex flex-col justify-end p-8 pb-16 z-10">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
      >
        <div className="flex items-center gap-2 mb-4">
          <div className="w-10 h-10 rounded-xl bg-blue-500/5 flex items-center justify-center border border-blue-500/10">
            <BrainCircuit className="w-6 h-6 text-blue-500" />
          </div>
        </div>
        
        <h1 className="text-5xl font-bold text-slate-800 leading-[1.1] mb-6 tracking-tight">
          Swasthya.Ai
        </h1>
        
        <p className="text-slate-400 text-lg mb-10 max-w-[280px] leading-relaxed font-light">
          Your advanced medical diagnostic companion, powered by clinical-grade LLMs.
        </p>
        
        <button 
          onClick={onInitialize}
          className="group relative w-full h-16 bg-blue-600 text-white rounded-2xl overflow-hidden transition-all hover:bg-blue-700 active:scale-[0.98] shadow-lg shadow-blue-500/10"
        >
          <div className="relative flex items-center justify-center gap-3 font-semibold text-lg">
            <span>Initialize System</span>
            <ChevronRight className="w-5 h-5" />
          </div>
        </button>
      </motion.div>
    </div>
  </div>
);

const ConnectionStatus = () => {
  const [isOnline, setIsOnline] = useState(window.navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <div className="flex flex-col items-center gap-1">
      <div className={`w-10 h-5 rounded-full p-1 transition-all duration-500 relative ${isOnline ? 'bg-emerald-500/20' : 'bg-slate-200'}`}>
        <motion.div
          animate={{ x: isOnline ? 20 : 0 }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
          className={`w-3 h-3 rounded-full shadow-sm ${isOnline ? 'bg-emerald-500' : 'bg-slate-400'}`}
        />
      </div>
      <span className={`text-[8px] font-bold uppercase tracking-widest ${isOnline ? 'text-emerald-500' : 'text-slate-400'}`}>
        {isOnline ? 'Online' : 'Offline'}
      </span>
    </div>
  );
};

const AuthScreen = ({ onAuth }: { onAuth: () => void }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState('Male');
  const [nationality, setNationality] = useState('');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [bloodGroup, setBloodGroup] = useState('');
  const [chronicDiseases, setChronicDiseases] = useState('');
  const [allergies, setAllergies] = useState('');
  const [currentMeds, setCurrentMeds] = useState('');
  const [surgeries, setSurgeries] = useState('');
  const [emergencyContact, setEmergencyContact] = useState('');
  const [smokingStatus, setSmokingStatus] = useState('Never');
  const [alcoholUse, setAlcoholUse] = useState('Never');
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 1024 * 1024) {
        setError("Image size should be less than 1MB");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoBase64(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAuth = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        await updateProfile(user, {
          displayName: fullName,
          photoURL: photoBase64
        });

        const userData: any = {
          uid: user.uid,
          email: email,
          full_name: fullName,
          created_at: new Date().toISOString()
        };

        if (phone) userData.phone = phone;
        if (dob) userData.dob = dob;
        if (gender) userData.gender = gender;
        if (nationality) userData.nationality = nationality;
        if (height) userData.height = parseFloat(height);
        if (weight) userData.weight = parseFloat(weight);
        if (bloodGroup) userData.blood_group = bloodGroup;
        if (chronicDiseases) userData.chronic_diseases = chronicDiseases;
        if (allergies) userData.allergies = allergies;
        if (currentMeds) userData.current_meds = currentMeds;
        if (surgeries) userData.surgeries = surgeries;
        if (emergencyContact) userData.emergency_contact = emergencyContact;
        if (smokingStatus) userData.smoking_status = smokingStatus;
        if (alcoholUse) userData.alcohol_use = alcoholUse;
        if (photoBase64) userData.photo_url = photoBase64;

        await setDoc(doc(db, 'users', user.uid), userData);
      }
      onAuth();
    } catch (err: any) {
      if (err.code === 'auth/operation-not-allowed') {
        setError("Email/Password sign-in is not enabled in Firebase Console. Please enable it in Authentication > Sign-in method.");
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const nextStep = () => setStep(s => s + 1);
  const prevStep = () => setStep(s => s - 1);

  return (
    <div className="h-full w-full bg-white overflow-y-auto no-scrollbar">
      <div className="p-8 pt-20">
        <div className="mb-12">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl font-bold text-slate-900 tracking-tight mb-3"
          >
            {isLogin ? 'Welcome Back' : (step === 1 ? 'Start Your Journey' : 'Clinical Profile')}
          </motion.h2>
          <p className="text-slate-500 font-light leading-relaxed">
            {isLogin ? 'Sign in to access your medical records' : `Step ${step} of 3: ${step === 1 ? 'Account Setup' : step === 2 ? 'Physical Vitals' : 'Medical History'}`}
          </p>
        </div>
        
        <form onSubmit={(e) => { e.preventDefault(); if (isLogin || step === 3) handleAuth(); else nextStep(); }} className="space-y-6">
          {error && (
            <div className="p-4 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-xs font-medium leading-relaxed">
              {error}
            </div>
          )}
          
          {isLogin ? (
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Email Address</label>
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="@example.com" 
                  className="w-full h-16 bg-slate-50 border-none rounded-2xl px-6 text-sm focus:ring-2 focus:ring-blue-500/20 transition-all" 
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Password</label>
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••" 
                  className="w-full h-16 bg-slate-50 border-none rounded-2xl px-6 text-sm focus:ring-2 focus:ring-blue-500/20 transition-all" 
                  required
                />
              </div>
            </div>
          ) : (
            <AnimatePresence mode="wait">
              {step === 1 && (
                <motion.div 
                  key="step1"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <div className="flex justify-center mb-8">
                    <div className="relative w-28 h-28 rounded-[32px] bg-slate-50 border-2 border-dashed border-slate-200 flex items-center justify-center overflow-hidden group">
                      {photoBase64 ? (
                        <img src={photoBase64} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <Camera className="w-8 h-8 text-slate-300" />
                      )}
                      <input 
                        type="file" 
                        accept="image/*" 
                        onChange={handleFileChange}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Full Name</label>
                    <input 
                      type="text" 
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Enter your full name" 
                      className="w-full h-16 bg-slate-50 border-none rounded-2xl px-6 text-sm focus:ring-2 focus:ring-blue-500/20 transition-all" 
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Email Address</label>
                    <input 
                      type="email" 
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="@example.com" 
                      className="w-full h-16 bg-slate-50 border-none rounded-2xl px-6 text-sm focus:ring-2 focus:ring-blue-500/20 transition-all" 
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Password</label>
                    <input 
                      type="password" 
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••" 
                      className="w-full h-16 bg-slate-50 border-none rounded-2xl px-6 text-sm focus:ring-2 focus:ring-blue-500/20 transition-all" 
                      required
                    />
                  </div>
                </motion.div>
              )}

              {step === 2 && (
                <motion.div 
                  key="step2"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">DOB</label>
                      <input type="date" value={dob} onChange={(e) => setDob(e.target.value)} className="w-full h-16 bg-slate-50 border-none rounded-2xl px-6 text-sm" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Gender</label>
                      <select value={gender} onChange={(e) => setGender(e.target.value)} className="w-full h-16 bg-slate-50 border-none rounded-2xl px-6 text-sm appearance-none">
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Height (cm)</label>
                      <input type="number" value={height} onChange={(e) => setHeight(e.target.value)} placeholder="175" className="w-full h-16 bg-slate-50 border-none rounded-2xl px-6 text-sm" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Weight (kg)</label>
                      <input type="number" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="70" className="w-full h-16 bg-slate-50 border-none rounded-2xl px-6 text-sm" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Blood Group</label>
                      <input type="text" value={bloodGroup} onChange={(e) => setBloodGroup(e.target.value)} placeholder="O+" className="w-full h-16 bg-slate-50 border-none rounded-2xl px-6 text-sm" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Nationality</label>
                      <input type="text" value={nationality} onChange={(e) => setNationality(e.target.value)} placeholder="Indian" className="w-full h-16 bg-slate-50 border-none rounded-2xl px-6 text-sm" />
                    </div>
                  </div>
                </motion.div>
              )}

              {step === 3 && (
                <motion.div 
                  key="step3"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Chronic Diseases</label>
                    <textarea value={chronicDiseases} onChange={(e) => setChronicDiseases(e.target.value)} placeholder="e.g. Diabetes" className="w-full h-24 bg-slate-50 border-none rounded-2xl p-4 text-sm resize-none" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Allergies</label>
                    <textarea value={allergies} onChange={(e) => setAllergies(e.target.value)} placeholder="e.g. Peanuts" className="w-full h-24 bg-slate-50 border-none rounded-2xl p-4 text-sm resize-none" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Current Medications</label>
                    <textarea value={currentMeds} onChange={(e) => setCurrentMeds(e.target.value)} placeholder="e.g. Metformin 500mg" className="w-full h-24 bg-slate-50 border-none rounded-2xl p-4 text-sm resize-none" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Past Surgeries</label>
                    <textarea value={surgeries} onChange={(e) => setSurgeries(e.target.value)} placeholder="e.g. Appendectomy (2015)" className="w-full h-24 bg-slate-50 border-none rounded-2xl p-4 text-sm resize-none" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Emergency Contact</label>
                    <input type="text" value={emergencyContact} onChange={(e) => setEmergencyContact(e.target.value)} placeholder="Name & Phone" className="w-full h-16 bg-slate-50 border-none rounded-2xl px-6 text-sm" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Smoking</label>
                      <select value={smokingStatus} onChange={(e) => setSmokingStatus(e.target.value)} className="w-full h-16 bg-slate-50 border-none rounded-2xl px-6 text-sm appearance-none">
                        <option value="Never">Never</option>
                        <option value="Former">Former</option>
                        <option value="Current">Current</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Alcohol</label>
                      <select value={alcoholUse} onChange={(e) => setAlcoholUse(e.target.value)} className="w-full h-16 bg-slate-50 border-none rounded-2xl px-6 text-sm appearance-none">
                        <option value="Never">Never</option>
                        <option value="Occasional">Occasional</option>
                        <option value="Frequent">Frequent</option>
                      </select>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          )}
          
          <div className="flex gap-4 pt-4">
            {!isLogin && step > 1 && (
              <button 
                type="button"
                onClick={prevStep}
                className="flex-1 h-16 bg-slate-100 text-slate-600 rounded-2xl font-bold transition-all active:scale-95"
              >
                Back
              </button>
            )}
            <button 
              type="submit"
              disabled={loading}
              className="flex-[2] h-16 bg-blue-600 text-white rounded-2xl font-bold shadow-xl shadow-blue-500/20 hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-50"
            >
              {loading ? 'Processing...' : (isLogin ? 'Sign In' : (step === 3 ? 'Complete Registration' : 'Continue'))}
            </button>
          </div>
        </form>
        
        <div className="mt-12 text-center pb-12">
          <button 
            onClick={() => { setIsLogin(!isLogin); setStep(1); }}
            className="text-sm text-slate-400 font-medium"
          >
            {isLogin ? "New patient? " : "Already registered? "}
            <span className="text-blue-600 font-bold">{isLogin ? 'Register Now' : 'Log In'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

const HomeScreen = ({ onNavigate, user }: { onNavigate: (s: Screen, mode?: ChatMode) => void, user: any }) => {
  const [patientData, setPatientData] = useState<any>(null);
  const [vitalsData, setVitalsData] = useState({
    hr: 72,
    o2: 98,
    bp: '120/80',
    temp: 36.6,
    resp: 16
  });

  useEffect(() => {
    if (user?.uid) {
      const unsubscribe = onSnapshot(doc(db, 'users', user.uid), (docSnap) => {
        if (docSnap.exists()) {
          setPatientData(docSnap.data());
        }
      }, (error) => {
        console.error("Error fetching patient data:", error);
      });
      return () => unsubscribe();
    }
  }, [user]);

  // Simulate real-time vitals flicker
  useEffect(() => {
    const interval = setInterval(() => {
      setVitalsData(prev => ({
        ...prev,
        hr: prev.hr + (Math.random() > 0.5 ? 1 : -1),
        o2: Math.min(100, Math.max(95, prev.o2 + (Math.random() > 0.8 ? 1 : Math.random() < 0.2 ? -1 : 0))),
        temp: Number((prev.temp + (Math.random() > 0.5 ? 0.01 : -0.01)).toFixed(2))
      }));
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const features = [
    { icon: Stethoscope, label: 'Symptom Analysis', doctor: 'Dr. Sharma', desc: 'Please describe your symptoms for clinical assessment', color: 'bg-emerald-500', action: () => onNavigate('chat', 'symptom') },
    { icon: Pill, label: 'Medicine', doctor: 'Dr. Gupta', desc: 'Search for a medicine by name to learn more', color: 'bg-orange-400', action: () => onNavigate('medicine') },
    { icon: ClipboardList, label: 'Reports', doctor: 'Dr. Verma', desc: 'View pending or new reports, or upload/scan', color: 'bg-blue-400', action: () => onNavigate('reports') },
    { icon: Video, label: 'Virtual Clinic', doctor: 'Dr. Iyer', desc: 'Doctor/Hospital contact and chat', color: 'bg-purple-400', action: () => onNavigate('clinic') },
  ];

  const vitals = [
    { label: 'Heart Rate', value: vitalsData.hr, unit: 'BPM', icon: Heart, color: 'text-red-500', bg: 'bg-red-50' },
    { label: 'SpO2', value: vitalsData.o2, unit: '%', icon: Activity, color: 'text-blue-500', bg: 'bg-blue-50' },
    { label: 'Temp', value: vitalsData.temp, unit: '°C', icon: Thermometer, color: 'text-emerald-500', bg: 'bg-emerald-50' },
  ];

  return (
    <div className="h-full w-full atmosphere overflow-y-auto pb-32 no-scrollbar">
      <header className="px-8 pt-16 pb-8 flex justify-between items-start">
        <div>
          <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-0.5">Hello</p>
          <h1 className="text-lg font-bold text-slate-900 tracking-tight">{patientData?.full_name || user?.displayName || user?.email?.split('@')[0] || 'Patient'}</h1>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl overflow-hidden border border-slate-100 shadow-sm">
            <img 
              src={patientData?.photo_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.email}`} 
              alt="Profile" 
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          </div>
        </div>
      </header>

      <div className="px-8 mb-8">
        <div className="relative group">
          <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
            <Search className="w-5 h-5 text-slate-300 group-focus-within:text-blue-500 transition-colors" />
          </div>
          <input 
            type="text" 
            placeholder="Search medical records" 
            className="w-full bg-slate-50/50 border border-slate-100 rounded-2xl py-4 pl-12 pr-12 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:bg-white transition-all placeholder:text-slate-500"
          />
          <div className="absolute inset-y-0 right-4 flex items-center">
            <Settings className="w-5 h-5 text-slate-300" />
          </div>
        </div>
      </div>

      <div className="px-8 mt-4">
        <div className="grid grid-cols-3 gap-3 mb-6">
          {vitals.map((v, i) => (
            <div key={i} className={`${v.bg} rounded-2xl p-4 flex flex-col items-center justify-center text-center relative overflow-hidden border border-white shadow-sm`}>
              <v.icon className={`w-4 h-4 ${v.color} mb-2`} />
              <span className="text-lg font-bold block text-slate-800">{v.value}</span>
              <span className="text-[8px] text-slate-400 font-mono uppercase tracking-widest">{v.label}</span>
            </div>
          ))}
        </div>

        <div className="bg-slate-100/50 rounded-3xl p-6 mb-8 relative overflow-hidden border border-slate-200/50">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-500" />
              <span className="text-[10px] font-mono uppercase tracking-widest text-slate-300">Vital Trends (24h)</span>
            </div>
            <span className="text-[10px] font-mono text-emerald-500 font-bold">Stable</span>
          </div>
          <div className="h-24 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={VITALS_HISTORY}>
                <defs>
                  <linearGradient id="colorHr" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <Area 
                  type="monotone" 
                  dataKey="hr" 
                  stroke="#ef4444" 
                  fillOpacity={1} 
                  fill="url(#colorHr)" 
                  strokeWidth={2} 
                  animationDuration={2000}
                />
                <Area 
                  type="monotone" 
                  dataKey="bp" 
                  stroke="#10b981" 
                  fill="transparent"
                  strokeWidth={2} 
                  animationDuration={2500}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <motion.button 
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          onClick={() => onNavigate('chat')}
          className="w-full bg-slate-100/50 rounded-[32px] p-8 text-left relative overflow-hidden group border border-slate-200/50"
        >
          <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
            <Sparkles className="w-12 h-12 text-blue-500" />
          </div>
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-4">
            </div>
            <h3 className="text-2xl font-bold text-slate-800 mb-2">How can I help <br />you today?</h3>
            <p className="text-slate-600 text-sm font-medium mb-6">Describe your symptoms for a precise clinical analysis.</p>
            <div className="flex items-center gap-2 text-blue-600 font-bold text-sm">
              <span>Start Consultation</span>
              <ChevronRight className="w-4 h-4" />
            </div>
          </div>
        </motion.button>
      </div>

      <section className="px-8 mt-12">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-sm font-bold text-slate-900">Services</h3>
        </div>
        <div className="flex justify-between items-center gap-2">
          {features.map((f, i) => (
            <button 
              key={i} 
              onClick={f.action}
              className="flex flex-col items-center gap-1 group"
            >
              <div className={`${f.color} w-14 h-14 rounded-2xl flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform border border-white`}>
                <f.icon className="w-6 h-6 text-white" />
              </div>
              <span className="text-[10px] font-bold text-slate-700">{f.label}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="px-8 mt-10">
        <div className="relative w-full h-40 rounded-[32px] bg-blue-50 overflow-hidden flex items-center p-8">
          <div className="relative z-10 max-w-[60%]">
            <h3 className="text-emerald-600 font-bold text-lg mb-2">Get the Best Medical Services</h3>
            <p className="text-slate-400 text-[10px] leading-relaxed">We provide best quality medical services without further cost</p>
          </div>
          <img 
            src="https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&q=80&w=400" 
            alt="Doctor" 
            className="absolute right-0 bottom-0 h-[120%] object-cover z-0 opacity-80"
            referrerPolicy="no-referrer"
          />
        </div>
      </section>

      <section className="px-8 mt-12">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-sm font-bold text-slate-900">Upcoming Appointments</h3>
        </div>
        <div className="space-y-4">
          <div className="bg-[#346e7a] rounded-[32px] p-6 flex items-center gap-6 text-white shadow-lg shadow-slate-200">
            <div className="w-16 h-16 bg-[#4da1b0] rounded-2xl flex flex-col items-center justify-center border border-white/10">
              <span className="text-xl font-bold">12</span>
              <span className="text-[10px] uppercase tracking-widest opacity-80">Tue</span>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="w-3 h-3 text-white/60" />
                <span className="text-[10px] text-white/80 font-bold">09:30 AM</span>
              </div>
              <h4 className="font-bold text-sm">Dr. Sharma</h4>
              <p className="text-[10px] opacity-60">Depression</p>
            </div>
            <button className="p-2">
              <MoreVertical className="w-5 h-5 opacity-40" />
            </button>
          </div>
        </div>
      </section>

      <section className="px-8 mt-12">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-sm font-bold text-slate-900">Latest Report</h3>
        </div>
        <div className="space-y-4">
          {[
            { label: 'General health', files: 5, icon: ClipboardList, color: 'bg-blue-100 text-blue-500' },
            { label: 'Diabetes', files: 8, icon: Activity, color: 'bg-purple-100 text-purple-500' },
          ].map((report, i) => (
            <div key={i} className="bg-white border border-slate-100 rounded-[28px] p-4 flex items-center gap-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${report.color}`}>
                <report.icon className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h4 className="font-bold text-sm text-slate-900">{report.label}</h4>
                <p className="text-[10px] text-slate-400">{report.files} files</p>
              </div>
              <button className="p-2">
                <MoreVertical className="w-5 h-5 text-slate-300" />
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

const ChatScreen = ({ onBack, mode = 'normal', user, existingChatId }: { onBack: () => void, mode?: ChatMode, user: any, existingChatId?: string | null }) => {
  const bgColor = mode === 'symptom' ? 'bg-emerald-50' : 'bg-red-50';
  const initialMessage = mode === 'symptom' 
    ? "Please describe your current symptoms for clinical assessment."
    : "I am Swasthya.Ai, your clinical intelligence assistant. I am ready to analyze your medical data. How can I assist you today?";

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [chatId, setChatId] = useState<string | null>(existingChatId || null);
  const [isListening, setIsListening] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Real-time chat listener
  useEffect(() => {
    if (!chatId) {
      setMessages([{ id: '1', text: initialMessage, sender: 'bot', timestamp: new Date() }]);
      return;
    }

    const chatRef = doc(db, 'chats', chatId);
    const unsubscribe = onSnapshot(chatRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.messages) {
          setMessages(data.messages.map((m: any) => ({
            ...m,
            timestamp: new Date(m.timestamp)
          })));
        }
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `chats/${chatId}`);
    });

    return () => unsubscribe();
  }, [chatId, initialMessage]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const saveChatToFirebase = async (newMessages: Message[]) => {
    if (!user?.uid) return;

    try {
      const chatData = {
        patient_id: user.uid,
        title: mode === 'symptom' ? 'Symptom Analysis' : 'General Consultation',
        last_message: newMessages[newMessages.length - 1].text,
        timestamp: new Date().toISOString(),
        mode: mode,
        messages: newMessages.map(m => ({
          text: m.text,
          sender: m.sender,
          timestamp: m.timestamp.toISOString()
        }))
      };

      if (chatId) {
        await setDoc(doc(db, 'chats', chatId), chatData, { merge: true });
      } else {
        const newChatRef = doc(collection(db, 'chats'));
        await setDoc(newChatRef, chatData);
        setChatId(newChatRef.id);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, chatId ? `chats/${chatId}` : 'chats');
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      text: input,
      sender: 'user',
      timestamp: new Date(),
    };

    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput('');
    setIsLoading(true);
    setIsProcessing(true);

    try {
      const history = updatedMessages.map(m => ({
        role: m.sender === 'user' ? 'user' as const : 'model' as const,
        parts: [{ text: m.text }]
      }));
      
      const botResponse = await healthcareChat(input, history);
      
      const botMsg: Message = {
        id: (Date.now() + 1).toString(),
        text: botResponse || "Clinical processing error. Please re-submit your query.",
        sender: 'bot',
        timestamp: new Date(),
      };
      
      const finalMessages = [...updatedMessages, botMsg];
      setMessages(finalMessages);
      await saveChatToFirebase(finalMessages);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
      setTimeout(() => setIsProcessing(false), 500);
    }
  };

  const startListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInput(transcript);
    };

    recognition.start();
  };

  const getHeaderStyles = () => {
    if (mode === 'normal') return 'bg-red-50/80 border-red-100 backdrop-blur-md';
    if (mode === 'symptom') return 'bg-emerald-50/80 border-emerald-100 backdrop-blur-md';
    return 'glass-dark border-slate-100';
  };

  const getButtonStyles = () => {
    if (mode === 'normal') return 'bg-red-100 border-red-200';
    if (mode === 'symptom') return 'bg-emerald-100 border-emerald-200';
    return 'glass';
  };

  const getIconColor = () => {
    if (mode === 'normal') return 'text-red-600';
    if (mode === 'symptom') return 'text-emerald-600';
    return 'text-slate-400';
  };

  const getTitleColor = () => {
    if (mode === 'normal') return 'text-red-900';
    if (mode === 'symptom') return 'text-emerald-900';
    return 'text-slate-800';
  };

  return (
    <div className={`h-full w-full flex flex-col ${bgColor}`}>
      <header className={`px-8 pt-16 pb-6 flex items-center justify-between ${getHeaderStyles()} border-b`}>
        <div className="flex items-center gap-4">
          <button onClick={onBack} className={`p-2 ${getButtonStyles()} rounded-xl hover:bg-slate-50 transition-colors`}>
            <ArrowLeft className={`w-5 h-5 ${getIconColor()}`} />
          </button>
          <div>
            <h1 className={`text-lg font-bold ${getTitleColor()}`}>Swasthya.Ai</h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className={`p-2 ${getButtonStyles()} rounded-xl`}>
            <MoreVertical className={`w-5 h-5 ${getIconColor()}`} />
          </button>
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-8 space-y-8 no-scrollbar">
        {messages.map((m) => (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            key={m.id} 
            className={`flex ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`max-w-[85%] p-5 rounded-3xl relative overflow-hidden ${
              m.sender === 'user' 
                ? 'bg-blue-600 text-white rounded-tr-none shadow-sm' 
                : 'glass text-slate-600 rounded-tl-none border border-slate-100'
            }`}>
              {m.sender === 'bot' && (
                <div className="absolute top-0 left-0 w-1 h-full bg-blue-500/20" />
              )}
              <p className="text-sm leading-relaxed whitespace-pre-wrap font-medium">{m.text}</p>
              <div className="flex items-center justify-between mt-3">
                <span className={`text-[9px] font-mono uppercase tracking-wider opacity-40`}>
                  {m.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          </motion.div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="glass p-5 rounded-3xl rounded-tl-none flex flex-col gap-3 min-w-[140px]">
              <div className="flex gap-1.5 items-center">
                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" />
                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:0.2s]" />
                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:0.4s]" />
                <span className="text-[10px] text-slate-400 font-mono ml-2 uppercase tracking-widest">
                  {mode === 'symptom' ? 'Analyzing' : 'Thinking'}
                </span>
              </div>
              <div className="h-1 w-full bg-slate-50 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: "0%" }}
                  animate={{ width: "100%" }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="h-full bg-blue-500"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="p-8 pt-4">
        <div className="glass rounded-[32px] p-2 flex items-center gap-2 shadow-sm border border-slate-100">
          <button className="p-4 text-slate-300 hover:text-blue-600 transition-colors">
            <Plus className="w-5 h-5" />
          </button>
          <input 
            type="text" 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Describe your medical query..."
            className="flex-1 bg-transparent border-none py-4 px-2 text-sm focus:outline-none placeholder:text-slate-500 text-slate-800"
          />
          <button 
            onClick={startListening}
            className={`p-4 transition-colors ${isListening ? 'text-red-500 animate-pulse' : 'text-slate-300 hover:text-blue-600'}`}
          >
            <Mic className="w-5 h-5" />
          </button>
          <button 
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="bg-blue-600 text-white p-4 rounded-2xl disabled:opacity-30 transition-all hover:bg-blue-700 active:scale-95 shadow-sm"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

const ScannerScreen = ({ onBack }: { onBack: () => void }) => {
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);

  const startScan = () => {
    setIsScanning(true);
    setScanProgress(0);
    const interval = setInterval(() => {
      setScanProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(() => setIsScanning(false), 1000);
          return 100;
        }
        return prev + 2;
      });
    }, 50);
  };

  return (
    <div className="h-full w-full bg-white relative flex flex-col overflow-hidden">
      <div className="absolute inset-0 z-0">
        <img 
          src="https://images.unsplash.com/photo-1516062423079-7ca13cdc7f5a?auto=format&fit=crop&q=80&w=1000" 
          alt="Scanner View" 
          className="h-full w-full object-cover opacity-5"
          referrerPolicy="no-referrer"
        />
      </div>

      <header className="relative z-10 px-8 pt-16 pb-6 flex items-center justify-between">
        <button onClick={onBack} className="p-3 glass rounded-2xl">
          <X className="w-5 h-5 text-slate-400" />
        </button>
        <h1 className="text-sm font-mono uppercase tracking-[0.3em] text-slate-800">Neural Diagnostics</h1>
        <div className="w-11" />
      </header>

      <div className="flex-1 relative z-10 flex items-center justify-center p-12">
        <div className="w-full aspect-[3/4] border border-slate-100 rounded-[48px] relative overflow-hidden glass shadow-xl">
          <div className="absolute top-0 left-0 w-16 h-16 border-t-2 border-l-2 border-blue-500 rounded-tl-[48px]" />
          <div className="absolute top-0 right-0 w-16 h-16 border-t-2 border-r-2 border-blue-500 rounded-tr-[48px]" />
          <div className="absolute bottom-0 left-0 w-16 h-16 border-b-2 border-l-2 border-blue-500 rounded-bl-[48px]" />
          <div className="absolute bottom-0 right-0 w-16 h-16 border-b-2 border-r-2 border-blue-500 rounded-br-[48px]" />
          
          <motion.div 
            animate={{ top: ['0%', '100%', '0%'] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            className="absolute left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-blue-500 to-transparent shadow-[0_0_20px_rgba(59,130,246,0.3)] z-20"
          />
          
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            {isScanning ? (
              <div className="flex flex-col items-center gap-4">
                <div className="w-32 h-32 rounded-full border-4 border-slate-50 border-t-blue-500 animate-spin" />
                <span className="text-2xl font-bold font-mono text-slate-800">{scanProgress}%</span>
                <span className="text-[10px] font-mono uppercase tracking-widest text-blue-500 font-bold">Analyzing Tissue Density</span>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center opacity-20">
                <Scan className="w-24 h-24 text-slate-300 mb-4" />
                <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400">Align Clinical Report</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="relative z-10 glass rounded-t-[48px] p-8 pb-16 border-t border-slate-100">
        <div className="w-12 h-1 bg-slate-100 rounded-full mx-auto mb-8" />
        <div className="flex items-center justify-between mb-8">
          <h3 className="text-lg font-bold text-slate-800">Diagnostic Input</h3>
          <button 
            onClick={startScan}
            className="px-6 py-3 bg-blue-600 rounded-2xl text-xs font-bold uppercase tracking-widest text-white hover:bg-blue-700 transition-colors shadow-sm"
          >
            Start Scan
          </button>
        </div>
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="aspect-square rounded-2xl glass overflow-hidden transition-all cursor-pointer border border-slate-100">
              <img 
                src={`https://images.unsplash.com/photo-${i === 1 ? '1530026405186-ed1f139313f8' : i === 2 ? '1559757175-5700dde675bc' : '1582719478250-c89cae4dc85b'}?auto=format&fit=crop&q=80&w=200`} 
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
          ))}
          <button className="aspect-square rounded-2xl glass flex items-center justify-center text-blue-600 hover:bg-slate-50 transition-colors">
            <Camera className="w-6 h-6" />
          </button>
        </div>
      </div>
    </div>
  );
};

const ReportsScreen = ({ user, onBack, onNavigate }: { user: any, onBack: () => void, onNavigate: (s: Screen) => void }) => {
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.uid) {
      const q = query(
        collection(db, 'reports'),
        where('patient_id', '==', user.uid),
        orderBy('date', 'desc')
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const reportList = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setReports(reportList);
        setLoading(false);
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, 'reports');
        setLoading(false);
      });

      return () => unsubscribe();
    }
  }, [user]);

  return (
    <div className="h-full w-full bg-blue-50 overflow-y-auto pb-32 no-scrollbar">
      <header className="px-8 pt-16 pb-8 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-3 glass rounded-2xl">
            <ArrowLeft className="w-5 h-5 text-slate-400" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-slate-800">Reports</h1>
            <p className="text-xs text-slate-500 mt-1">View pending or new reports</p>
          </div>
        </div>
        <button onClick={() => onNavigate('scanner')} className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20">
          <Scan className="w-5 h-5 text-white" />
        </button>
      </header>

      <div className="px-8 mb-8">
        <div className="flex gap-4 mb-8">
          <button className="flex-1 py-3 bg-blue-50 text-blue-600 rounded-2xl font-bold text-xs border border-blue-100">Pending</button>
          <button className="flex-1 py-3 bg-white text-slate-400 rounded-2xl font-bold text-xs border border-slate-100">Completed</button>
        </div>
        
        <div className="p-6 border-2 border-dashed border-slate-100 rounded-[32px] flex flex-col items-center justify-center text-center gap-4 bg-slate-50/30 cursor-pointer hover:bg-slate-50 transition-colors" onClick={() => onNavigate('scanner')}>
          <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm">
            <Plus className="w-6 h-6 text-blue-500" />
          </div>
          <div>
            <h4 className="font-bold text-sm text-slate-800">Upload or Scan Report</h4>
            <p className="text-[10px] text-slate-400 mt-1">PDF, JPG or direct camera scan</p>
          </div>
        </div>
      </div>

      <div className="px-8 mt-4 space-y-8">
        <div>
          <h3 className="text-[10px] font-mono uppercase tracking-[0.3em] text-slate-300 mb-6">Recent Reports</h3>
          <div className="space-y-4">
            {loading ? (
              <div className="flex justify-center py-12">
                <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : reports.length > 0 ? (
              reports.map((report, j) => (
                <div key={j} className="glass rounded-[28px] p-6 flex items-start gap-4 hover:bg-slate-50 transition-colors cursor-pointer border border-slate-100">
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center">
                    <ClipboardList className="w-5 h-5 text-blue-500" />
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-center mb-1">
                      <h4 className="font-bold text-sm text-slate-800">{report.title}</h4>
                      <span className={`text-[9px] font-bold uppercase tracking-wider ${
                        report.status === 'Completed' ? 'text-emerald-500' : 
                        report.status === 'New' ? 'text-blue-500' : 'text-orange-500'
                      }`}>{report.status}</span>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed font-light">{report.date}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12 text-slate-400 text-sm">No reports found</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const HistoryScreen = ({ user, onNavigate }: { user: any, onNavigate: (s: Screen, m?: ChatMode, id?: string) => void }) => {
  const [chats, setChats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (user?.uid) {
      const q = query(
        collection(db, 'chats'),
        where('patient_id', '==', user.uid),
        orderBy('timestamp', 'desc')
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const chatList = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setChats(chatList);
        setLoading(false);
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, 'chats');
        setLoading(false);
      });

      return () => unsubscribe();
    }
  }, [user]);

  const handleDeleteChat = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeletingId(id);
  };

  const confirmDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteDoc(doc(db, 'chats', id));
      setDeletingId(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `chats/${id}`);
    }
  };

  const cancelDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDeletingId(null);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    if (date.toDateString() === now.toDateString()) return 'Today';
    const yesterday = new Date();
    yesterday.setDate(now.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return date.toLocaleDateString();
  };

  return (
    <div className="h-full w-full atmosphere overflow-y-auto pb-32 no-scrollbar">
      <header className="px-8 pt-16 pb-8 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Chat History</h1>
          <p className="text-xs text-slate-500 mt-1">View your previous consultations</p>
        </div>
        <button className="w-12 h-12 glass rounded-2xl flex items-center justify-center">
          <Search className="w-5 h-5 text-slate-400" />
        </button>
      </header>

      <div className="px-8 mt-4 space-y-8">
        {loading ? (
          <div className="text-center py-20 text-slate-400 font-mono text-[10px] uppercase tracking-widest">Loading History...</div>
        ) : chats.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <MessageSquare className="w-8 h-8 text-slate-200" />
            </div>
            <p className="text-slate-400 text-sm">No consultation history found</p>
          </div>
        ) : (
          chats.map((chat, i) => (
            <div key={chat.id}>
              {(i === 0 || formatDate(chats[i-1].timestamp) !== formatDate(chat.timestamp)) && (
                <h3 className="text-[10px] font-mono uppercase tracking-[0.3em] text-slate-300 mb-6 mt-8">{formatDate(chat.timestamp)}</h3>
              )}
              <div 
                onClick={() => onNavigate('chat', chat.mode || 'normal', chat.id)}
                className="glass rounded-[28px] p-6 flex items-start gap-4 hover:bg-slate-50 transition-colors cursor-pointer border border-slate-100 mb-4 group relative overflow-hidden"
              >
                <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center">
                  <MessageSquare className="w-5 h-5 text-blue-500" />
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-center mb-1">
                    <h4 className="font-bold text-sm text-slate-800">{chat.title}</h4>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-mono text-slate-300">{new Date(chat.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      <button 
                        onClick={(e) => handleDeleteChat(chat.id, e)}
                        className="p-1 opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 transition-all"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed font-light">
                    {chat.last_message || 'Consultation summary not available'}
                  </p>
                </div>

                <AnimatePresence>
                  {deletingId === chat.id && (
                    <motion.div 
                      initial={{ opacity: 0, x: 100 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 100 }}
                      className="absolute inset-0 bg-red-500 flex items-center justify-center gap-6 z-10"
                    >
                      <span className="text-white font-bold text-xs uppercase tracking-widest">Delete History?</span>
                      <div className="flex gap-2">
                        <button onClick={cancelDelete} className="px-4 py-2 bg-white/20 rounded-xl text-white text-[10px] font-bold uppercase tracking-widest">No</button>
                        <button onClick={(e) => confirmDelete(chat.id, e)} className="px-4 py-2 bg-white rounded-xl text-red-500 text-[10px] font-bold uppercase tracking-widest">Yes</button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

const MedicineScreen = ({ onBack }: { onBack: () => void }) => {
  const [search, setSearch] = useState('');
  const [medicines, setMedicines] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'medicines'), orderBy('name'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const meds = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setMedicines(meds);
      setIsLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'medicines');
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const filteredMeds = medicines.filter(m => 
    m.name.toLowerCase().includes(search.toLowerCase()) || 
    (m.composition && m.composition.toLowerCase().includes(search.toLowerCase())) ||
    (m.uses && m.uses.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="h-full w-full atmosphere overflow-y-auto pb-32 no-scrollbar">
      <header className="px-8 pt-16 pb-8 flex items-center gap-4">
        <button onClick={onBack} className="p-3 glass rounded-2xl">
          <ArrowLeft className="w-5 h-5 text-slate-400" />
        </button>
        <h1 className="text-2xl font-bold text-slate-800">Medicine</h1>
      </header>

      <div className="px-8 mb-8">
        <div className="relative group mb-8">
          <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
            <Search className="w-5 h-5 text-slate-400" />
          </div>
          <input 
            type="text" 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Enter medicine name for detailed information" 
            className="w-full h-16 bg-slate-50 border-none rounded-2xl px-12 text-sm focus:ring-2 focus:ring-blue-500/20 transition-all placeholder:text-slate-400"
          />
        </div>

        <div className="space-y-6">
          <h3 className="text-[10px] font-mono uppercase tracking-[0.3em] text-slate-300">
            {search ? 'Search Results' : 'Clinical Pharmacopeia'}
          </h3>
          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filteredMeds.length > 0 ? (
            filteredMeds.map((med, i) => (
              <div key={i} className="glass rounded-[28px] p-6 border border-slate-100 hover:bg-slate-50 transition-colors cursor-pointer group">
                <div className="flex gap-4">
                  {med.image_url && (
                    <div className="w-16 h-16 rounded-2xl overflow-hidden flex-shrink-0 border border-slate-100">
                      <img src={med.image_url} alt={med.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    </div>
                  )}
                  <div className="flex-1">
                    <h4 className="font-bold text-slate-800 mb-1 group-hover:text-blue-600 transition-colors">{med.name}</h4>
                    <p className="text-[10px] font-mono text-blue-500 uppercase tracking-wider mb-2">{med.manufacturer}</p>
                    <p className="text-xs text-slate-500 leading-relaxed line-clamp-2 mb-3">{med.uses}</p>
                    <div className="flex flex-wrap gap-2">
                      <span className="px-2 py-1 bg-slate-100 rounded-lg text-[9px] font-bold text-slate-500 uppercase tracking-tighter">Composition: {med.composition}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-12 text-slate-400 text-sm">No medicines found matching "{search}"</div>
          )}
        </div>
      </div>
    </div>
  );
};

const ClinicScreen = ({ onBack, onChat }: { onBack: () => void, onChat: (mode: ChatMode) => void }) => {
  return (
    <div className="h-full w-full bg-purple-50 overflow-y-auto pb-32 no-scrollbar">
      <header className="px-8 pt-16 pb-8 flex items-center gap-4">
        <button onClick={onBack} className="p-3 glass rounded-2xl">
          <ArrowLeft className="w-5 h-5 text-slate-400" />
        </button>
        <h1 className="text-2xl font-bold text-slate-800">Virtual Clinic</h1>
      </header>

      <div className="px-8 space-y-8">
        <div className="glass rounded-[32px] p-8 border border-slate-100 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-6 opacity-5">
            <Video className="w-16 h-16 text-purple-500" />
          </div>
          <div className="relative z-10">
            <h3 className="text-xl font-bold text-slate-800 mb-4">Hospital Contact</h3>
            <div className="space-y-4 mb-8">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                  <Settings className="w-4 h-4 text-blue-500" />
                </div>
                <span className="text-sm text-slate-600">+91 98765 43210</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                  <Home className="w-4 h-4 text-emerald-500" />
                </div>
                <span className="text-sm text-slate-600">Apollo Hospital, New Delhi</span>
              </div>
            </div>
            <button onClick={() => onChat('normal')} className="w-full py-4 bg-purple-600 text-white rounded-2xl font-bold text-sm shadow-lg shadow-purple-500/20 hover:bg-purple-700 transition-colors">
              Direct Chat with Doctor
            </button>
          </div>
        </div>

        <div>
          <h3 className="text-[10px] font-mono uppercase tracking-[0.3em] text-slate-300 mb-6">Available Doctors</h3>
          <div className="space-y-4">
            {[
              { name: 'Dr. Sharma', spec: 'Cardiologist', status: 'Online' },
              { name: 'Dr. Gupta', spec: 'General Physician', status: 'Online' }
            ].map((doc, i) => (
              <div key={i} className="glass rounded-[28px] p-6 flex items-center justify-between border border-slate-100">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-slate-50 overflow-hidden">
                    <img src={`https://images.unsplash.com/photo-${i === 0 ? '1612349317150-e413f6a5b16d' : '1537368910025-700350fe46c7'}?auto=format&fit=crop&q=80&w=200`} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-slate-800">{doc.name}</h4>
                    <p className="text-[10px] text-slate-400">{doc.spec}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span className="text-[10px] text-emerald-500 font-bold uppercase tracking-widest">{doc.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const ProfileScreen = ({ user, onNavigate }: { user: any, onNavigate: (s: Screen) => void }) => {
  const [patientData, setPatientData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [newDetail, setNewDetail] = useState({ label: '', value: '' });
  const [editData, setEditData] = useState<any>({});

  useEffect(() => {
    if (user?.uid) {
      const unsubscribe = onSnapshot(doc(db, 'users', user.uid), (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setPatientData(data);
          setEditData(data);
        }
        setLoading(false);
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
        setLoading(false);
      });
      return () => unsubscribe();
    }
  }, [user]);

  const handleUpdateProfile = async () => {
    if (!user?.uid) return;
    try {
      // Clean data before saving: remove empty strings and ensure types
      const cleanedData: any = {};
      Object.entries(editData).forEach(([key, value]) => {
        if (value === '' || value === null || value === undefined) {
          // Skip empty values to avoid rule violations
          return;
        }
        
        if ((key === 'height' || key === 'weight') && typeof value === 'string') {
          const num = parseFloat(value);
          if (!isNaN(num)) cleanedData[key] = num;
        } else {
          cleanedData[key] = value;
        }
      });

      await setDoc(doc(db, 'users', user.uid), cleanedData, { merge: true });
      setShowEditModal(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}`);
    }
  };

  const handleAddDetail = async () => {
    if (!newDetail.label || !newDetail.value || !user?.uid) return;
    
    try {
      const docRef = doc(db, 'users', user.uid);
      let fieldName = newDetail.label.toLowerCase().trim().replace(/\s+/g, '_');
      
      // Flexible mapping
      if (fieldName.includes('weight')) fieldName = 'weight';
      if (fieldName.includes('height')) fieldName = 'height';
      if (fieldName.includes('blood')) fieldName = 'blood_group';
      if (fieldName.includes('nationality')) fieldName = 'nationality';
      if (fieldName.includes('dob') || fieldName.includes('birth')) fieldName = 'dob';
      if (fieldName.includes('smoking')) fieldName = 'smoking_status';
      if (fieldName.includes('alcohol')) fieldName = 'alcohol_use';
      if (fieldName.includes('chronic')) fieldName = 'chronic_diseases';
      if (fieldName.includes('allergies')) fieldName = 'allergies';
      if (fieldName.includes('medication')) fieldName = 'current_meds';
      if (fieldName.includes('surgeries')) fieldName = 'surgeries';
      if (fieldName.includes('emergency')) fieldName = 'emergency_contact';
      if (fieldName.includes('name')) fieldName = 'full_name';

      let value: any = newDetail.value;
      if (fieldName === 'weight' || fieldName === 'height') {
        value = parseFloat(newDetail.value);
        if (isNaN(value)) {
          alert("Please enter a valid number for weight/height");
          return;
        }
      }

      await setDoc(docRef, { [fieldName]: value }, { merge: true });
      
      setShowAddModal(false);
      setNewDetail({ label: '', value: '' });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}`);
    }
  };

  const stats = [
    { label: 'Weight', value: patientData?.weight ? `${patientData.weight}kg` : '-', color: 'text-blue-500' },
    { label: 'Height', value: patientData?.height ? `${patientData.height}cm` : '-', color: 'text-emerald-500' },
    { label: 'Blood', value: patientData?.blood_group || '-', color: 'text-red-500' },
  ];

  const handleSignOut = async () => {
    await auth.signOut();
  };

  if (loading) return <div className="h-full w-full flex items-center justify-center font-mono text-[10px] uppercase tracking-widest text-slate-400">Loading Profile...</div>;

  return (
    <div className="h-full w-full bg-white atmosphere overflow-y-auto pb-32 no-scrollbar">
      <header className="px-8 pt-16 pb-8 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Medical Profile</h1>
          <p className="text-xs text-slate-500 mt-1">{patientData?.full_name || 'Patient Record'}</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => setShowEditModal(true)}
            className="w-12 h-12 glass rounded-2xl flex items-center justify-center text-slate-400 hover:text-blue-600 transition-colors"
          >
            <Edit className="w-5 h-5" />
          </button>
          <button 
            onClick={() => setShowAddModal(true)}
            className="w-12 h-12 glass rounded-2xl flex items-center justify-center text-blue-600 hover:bg-blue-50 transition-colors"
          >
            <Plus className="w-5 h-5" />
          </button>
          <button onClick={() => onNavigate('settings')} className="w-12 h-12 glass rounded-2xl flex items-center justify-center">
            <Settings className="w-5 h-5 text-slate-400" />
          </button>
        </div>
      </header>

      <AnimatePresence>
        {showEditModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-8 bg-slate-900/40 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="w-full max-w-sm glass rounded-[40px] p-8 border border-white shadow-2xl overflow-y-auto max-h-[80vh] no-scrollbar"
            >
              <h3 className="text-xl font-bold text-slate-800 mb-6">Edit Profile</h3>
              <div className="space-y-4 mb-8">
                {[
                  { label: 'Full Name', key: 'full_name', type: 'text' },
                  { label: 'DOB', key: 'dob', type: 'date' },
                  { label: 'Height (cm)', key: 'height', type: 'number' },
                  { label: 'Weight (kg)', key: 'weight', type: 'number' },
                  { label: 'Blood Group', key: 'blood_group', type: 'text' },
                  { label: 'Nationality', key: 'nationality', type: 'text' },
                  { label: 'Chronic Diseases', key: 'chronic_diseases', type: 'textarea' },
                  { label: 'Allergies', key: 'allergies', type: 'textarea' },
                  { label: 'Current Medications', key: 'current_meds', type: 'textarea' },
                  { label: 'Past Surgeries', key: 'surgeries', type: 'textarea' },
                  { label: 'Emergency Contact', key: 'emergency_contact', type: 'text' },
                ].map(field => (
                  <div key={field.key}>
                    <label className="text-[10px] font-mono uppercase tracking-widest text-slate-400 mb-2 block">{field.label}</label>
                    {field.type === 'textarea' ? (
                      <textarea 
                        value={editData[field.key] || ''}
                        onChange={(e) => setEditData((prev: any) => ({ ...prev, [field.key]: e.target.value }))}
                        className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 text-sm focus:ring-2 focus:ring-blue-500/20 transition-all h-24 resize-none"
                      />
                    ) : (
                      <input 
                        type={field.type}
                        value={editData[field.key] || ''}
                        onChange={(e) => setEditData((prev: any) => ({ ...prev, [field.key]: field.type === 'number' ? parseFloat(e.target.value) : e.target.value }))}
                        className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 text-sm focus:ring-2 focus:ring-blue-500/20 transition-all"
                      />
                    )}
                  </div>
                ))}
              </div>
              <div className="flex gap-3">
                <button 
                  onClick={() => setShowEditModal(false)}
                  className="flex-1 py-4 text-slate-400 font-bold text-sm"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleUpdateProfile}
                  className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-bold text-sm shadow-lg shadow-blue-500/20"
                >
                  Save Changes
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {showAddModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-8 bg-slate-900/40 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="w-full max-w-sm glass rounded-[40px] p-8 border border-white shadow-2xl"
            >
              <h3 className="text-xl font-bold text-slate-800 mb-6">Add Clinical Detail</h3>
              <div className="space-y-4 mb-8">
                <div>
                  <label className="text-[10px] font-mono uppercase tracking-widest text-slate-400 mb-2 block">Field Name</label>
                  <input 
                    type="text" 
                    value={newDetail.label}
                    onChange={(e) => setNewDetail(prev => ({ ...prev, label: e.target.value }))}
                    placeholder="e.g. Blood Pressure, Glucose"
                    className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 text-sm focus:ring-2 focus:ring-blue-500/20 transition-all"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-mono uppercase tracking-widest text-slate-400 mb-2 block">Value</label>
                  <input 
                    type="text" 
                    value={newDetail.value}
                    onChange={(e) => setNewDetail(prev => ({ ...prev, value: e.target.value }))}
                    placeholder="Enter value"
                    className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 text-sm focus:ring-2 focus:ring-blue-500/20 transition-all"
                  />
                </div>
              </div>
              <div className="flex gap-3">
                <button 
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-4 text-slate-400 font-bold text-sm"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleAddDetail}
                  className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-bold text-sm shadow-lg shadow-blue-500/20"
                >
                  Add Record
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="px-8 mt-4">
        <div className="glass rounded-[40px] p-8 text-center relative overflow-hidden border border-slate-100">
          <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-b from-blue-500/5 to-transparent" />
          <div className="relative z-10">
            <div className="w-24 h-24 rounded-[32px] glass mx-auto mb-6 p-1 border border-slate-50 overflow-hidden">
              <img 
                src={patientData?.photo_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.email}`} 
                alt="User" 
                className="w-full h-full object-cover rounded-[28px]"
                referrerPolicy="no-referrer"
              />
            </div>
            <h2 className="text-2xl font-bold text-slate-800 mb-1">{patientData?.full_name || 'Patient'}</h2>
            <p className="text-slate-300 font-mono text-[10px] uppercase tracking-widest mb-8">Patient ID: {user?.uid?.slice(0, 8).toUpperCase()}</p>
            
            <div className="grid grid-cols-3 gap-4">
              {stats.map((s, i) => (
                <div key={i} className="bg-white/50 rounded-2xl p-4 border border-slate-50">
                  <p className={`text-sm font-bold ${s.color} mb-1`}>{s.value}</p>
                  <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-8 space-y-6">
          <div className="space-y-4">
            <h3 className="text-[10px] font-mono uppercase tracking-[0.3em] text-slate-300 ml-2">Clinical Details</h3>
            <div className="grid grid-cols-1 gap-4">
              {[
                { label: 'Chronic Diseases', value: patientData?.chronic_diseases, icon: Activity, color: 'text-amber-500', bg: 'bg-amber-50' },
                { label: 'Allergies', value: patientData?.allergies, icon: Wind, color: 'text-red-500', bg: 'bg-red-50' },
                { label: 'Current Medications', value: patientData?.current_meds, icon: Pill, color: 'text-blue-500', bg: 'bg-blue-50' },
                { label: 'Past Surgeries', value: patientData?.surgeries, icon: Stethoscope, color: 'text-purple-500', bg: 'bg-purple-50' }
              ].map((item, i) => (
                <div key={i} className="glass rounded-3xl p-6 border border-slate-100 flex items-start gap-4">
                  <div className={`w-10 h-10 rounded-xl ${item.bg} flex items-center justify-center flex-shrink-0`}>
                    <item.icon className={`w-5 h-5 ${item.color}`} />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{item.label}</p>
                    <p className="text-sm text-slate-700 leading-relaxed">{item.value || 'None reported'}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-[10px] font-mono uppercase tracking-[0.3em] text-slate-300 ml-2">Personal & Social</h3>
            <div className="glass rounded-[32px] p-6 border border-slate-100 space-y-6">
              <div className="grid grid-cols-2 gap-8">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Nationality</p>
                  <p className="text-sm text-slate-800 font-medium">{patientData?.nationality || '-'}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">DOB</p>
                  <p className="text-sm text-slate-800 font-medium">{patientData?.dob || '-'}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-8">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Smoking</p>
                  <p className="text-sm text-slate-800 font-medium">{patientData?.smoking_status || '-'}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Alcohol</p>
                  <p className="text-sm text-slate-800 font-medium">{patientData?.alcohol_use || '-'}</p>
                </div>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Emergency Contact</p>
                <p className="text-sm text-slate-800 font-medium">{patientData?.emergency_contact || 'Not provided'}</p>
              </div>
            </div>
          </div>
          <div className="space-y-4">
            <h3 className="text-[10px] font-mono uppercase tracking-[0.3em] text-slate-300 ml-2">Other Details</h3>
            <div className="glass rounded-[32px] p-6 border border-slate-100 space-y-4">
              {patientData && Object.entries(patientData).map(([key, value]) => {
                const skipFields = [
                  'uid', 'email', 'full_name', 'photo_url', 'created_at',
                  'weight', 'height', 'blood_group', 'chronic_diseases',
                  'allergies', 'current_meds', 'surgeries', 'nationality',
                  'dob', 'smoking_status', 'alcohol_use', 'emergency_contact',
                  'phone', 'gender'
                ];
                if (skipFields.includes(key)) return null;
                
                const displayLabel = key.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
                return (
                  <div key={key} className="flex justify-between items-center py-2 border-b border-slate-50 last:border-0">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{displayLabel}</span>
                    <span className="text-sm text-slate-800 font-medium">{String(value)}</span>
                  </div>
                );
              })}
              {(!patientData || Object.keys(patientData).filter(k => ![
                  'uid', 'email', 'full_name', 'photo_url', 'created_at',
                  'weight', 'height', 'blood_group', 'chronic_diseases',
                  'allergies', 'current_meds', 'surgeries', 'nationality',
                  'dob', 'smoking_status', 'alcohol_use', 'emergency_contact',
                  'phone', 'gender'
                ].includes(k)).length === 0) && (
                <p className="text-[10px] text-slate-300 italic text-center py-4">No additional details added</p>
              )}
            </div>
          </div>
        </div>

        <button 
          onClick={handleSignOut}
          className="w-full mt-12 py-4 text-red-500 font-mono text-[10px] uppercase tracking-[0.3em] border border-red-500/10 rounded-2xl hover:bg-red-50 transition-colors"
        >
          Log Out
        </button>
      </div>
    </div>
  );
};

const SettingsScreen = ({ onBack, user }: { onBack: () => void, user: any }) => {
  return (
    <div className="h-full w-full atmosphere overflow-y-auto pb-32 no-scrollbar">
      <header className="px-8 pt-16 pb-8 flex items-center gap-4">
        <button onClick={onBack} className="p-3 glass rounded-2xl">
          <ArrowLeft className="w-5 h-5 text-slate-400" />
        </button>
        <h1 className="text-2xl font-bold text-slate-800">Settings</h1>
      </header>

      <div className="px-8 space-y-6">
        <div className="glass rounded-[32px] p-6 border border-slate-100 space-y-4">
          <h3 className="text-[10px] font-mono uppercase tracking-widest text-slate-300 mb-2">Account</h3>
          <div className="flex items-center justify-between py-2">
            <span className="text-sm text-slate-600">Email Notifications</span>
            <div className="w-10 h-6 bg-blue-600 rounded-full relative">
              <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full" />
            </div>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-sm text-slate-600">Biometric Login</span>
            <div className="w-10 h-6 bg-slate-200 rounded-full relative">
              <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full" />
            </div>
          </div>
        </div>

        <div className="glass rounded-[32px] p-6 border border-slate-100 space-y-4">
          <h3 className="text-[10px] font-mono uppercase tracking-widest text-slate-300 mb-2">Privacy</h3>
          <button className="w-full text-left py-2 text-sm text-slate-600 flex justify-between items-center">
            Data Sharing Preferences
            <ChevronRight className="w-4 h-4 text-slate-300" />
          </button>
          <button className="w-full text-left py-2 text-sm text-slate-600 flex justify-between items-center">
            Terms of Service
            <ChevronRight className="w-4 h-4 text-slate-300" />
          </button>
        </div>

        <div className="p-6 text-center">
          <p className="text-[10px] font-mono text-slate-300 uppercase tracking-widest">App Version 2.4.0 (Stable)</p>
        </div>
      </div>
    </div>
  );
};

// --- Main App ---

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('splash');
  const [chatMode, setChatMode] = useState<ChatMode>('normal');
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setUser(user);
      if (user) {
        if (currentScreen === 'splash' || currentScreen === 'auth') {
          setCurrentScreen('home');
        }
      } else {
        if (currentScreen !== 'splash') {
          setCurrentScreen('auth');
        }
      }
    });

    return () => unsubscribe();
  }, [currentScreen]);

  const handleNavigate = (screen: Screen, mode: ChatMode = 'normal', id?: string) => {
    setChatMode(mode);
    setSelectedChatId(id || null);
    setCurrentScreen(screen);
  };

  const renderScreen = () => {
    switch (currentScreen) {
      case 'splash': return <SplashScreen onInitialize={() => setCurrentScreen('auth')} />;
      case 'auth': return <AuthScreen onAuth={() => setCurrentScreen('home')} />;
      case 'home': return <HomeScreen onNavigate={handleNavigate} user={user} />;
      case 'chat': return <ChatScreen onBack={() => setCurrentScreen('home')} mode={chatMode} user={user} existingChatId={selectedChatId} />;
      case 'medicine': return <MedicineScreen onBack={() => setCurrentScreen('home')} />;
      case 'clinic': return <ClinicScreen onBack={() => setCurrentScreen('home')} onChat={(mode) => handleNavigate('chat', mode)} />;
      case 'scanner': return <ScannerScreen onBack={() => setCurrentScreen('home')} />;
      case 'reports': return <ReportsScreen onBack={() => setCurrentScreen('home')} onNavigate={handleNavigate} />;
      case 'history': return <HistoryScreen user={user} onNavigate={handleNavigate} />;
      case 'profile': return <ProfileScreen user={user} onNavigate={handleNavigate} />;
      case 'settings': return <SettingsScreen onBack={() => setCurrentScreen('profile')} user={user} />;
      default: return <HomeScreen onNavigate={handleNavigate} user={user} />;
    }
  };

  const showNav = currentScreen !== 'splash' && currentScreen !== 'auth' && currentScreen !== 'chat' && currentScreen !== 'scanner';

  return (
    <div className="h-screen w-full max-w-md mx-auto bg-white shadow-2xl relative overflow-hidden font-sans selection:bg-blue-500/5">
      <AnimatePresence mode="wait">
        <motion.div
          key={currentScreen}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
          className="h-full w-full"
        >
          {renderScreen()}
        </motion.div>
      </AnimatePresence>

      {showNav && (
        <div className="absolute bottom-8 left-8 right-8 z-50">
          <nav className="glass rounded-[32px] p-2 flex justify-between items-center shadow-xl shadow-blue-500/5 border border-slate-100">
            {[
              { id: 'home', icon: Home },
              { id: 'chat', icon: MessageSquare, mode: 'normal' },
              { id: 'history', icon: Clock },
              { id: 'profile', icon: User }
            ].map(item => (
              <button 
                key={item.id}
                onClick={() => handleNavigate(item.id as Screen, (item as any).mode || 'normal')}
                className={`p-4 rounded-2xl transition-all relative ${
                  currentScreen === item.id 
                    ? 'text-blue-600' 
                    : 'text-slate-300 hover:text-slate-500'
                }`}
              >
                {currentScreen === item.id && (
                  <motion.div 
                    layoutId="nav-glow"
                    className="absolute inset-0 bg-blue-50 rounded-2xl"
                  />
                )}
                <item.icon className="w-5 h-5 relative z-10" />
              </button>
            ))}
          </nav>
        </div>
      )}
    </div>
  );
}
