import React,{useEffect,useMemo,useState} from 'react';
import {Link,useNavigate} from 'react-router-dom';
import {Loader2,Phone,KeyRound,ShieldCheck,Mail,MapPin,ChevronRight,ChevronLeft,Lock} from 'lucide-react';

const NIGERIAN_STATES = ['Abia','Adamawa','Akwa Ibom','Anambra','Bauchi','Bayelsa','Benue','Borno','Cross River','Delta','Ebonyi','Edo','Ekiti','Enugu','Federal Capital Territory','Gombe','Imo','Jigawa','Kaduna','Kano','Katsina','Kebbi','Kogi','Kwara','Lagos','Nasarawa','Niger','Ogun','Ondo','Osun','Oyo','Plateau','Rivers','Sokoto','Taraba','Yobe','Zamfara'];

const weakLoginPins=new Set(['000000','111111','123456','654321','121212','112233','123123']);
const weakTransactionPins=new Set(['0000','1111','2222','3333','4444','5555','6666','7777','8888','9999','1234','4321','1212','2121']);

function validPhone(value:string){return /^0\d{10}$/.test(value);}
function passwordGuidance(value:string){return [{ok:/^\d{6}$/.test(value),label:'Exactly 6 digits'},{ok:value.length===6&&!weakLoginPins.has(value),label:'Not an obvious or common pattern'}];}

export default function RegisterPage(){
  const navigate=useNavigate();
  const [step,setStep]=useState<'phone'|'details'|'security'>('phone');
  const [phone,setPhone]=useState('');
  const [code,setCode]=useState('');
  const [registrationToken,setRegistrationToken]=useState('');
  const [otpRemaining,setOtpRemaining]=useState(0);
  const [resendRemaining,setResendRemaining]=useState(0);
  const [firstName,setFirstName]=useState('');
  const [otherName,setOtherName]=useState('');
  const [lastName,setLastName]=useState('');
  const [email,setEmail]=useState('');
  const [state,setState]=useState('');
  const [lga,setLga]=useState('');
  const [town,setTown]=useState('');
  const [area,setArea]=useState('');
  const [fullAddress,setFullAddress]=useState('');
  const [landmark,setLandmark]=useState('');
  const [nin,setNin]=useState('');
  const [bvn,setBvn]=useState('');
  const [password,setPassword]=useState('');
  const [confirmPassword,setConfirmPassword]=useState('');
  const [transactionPin,setTransactionPin]=useState('');
  const [confirmTransactionPin,setConfirmTransactionPin]=useState('');
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState('');
  const [message,setMessage]=useState('');

  useEffect(()=>{if(!otpRemaining)return;const id=window.setInterval(()=>setOtpRemaining(v=>Math.max(0,v-1)),1000);return()=>window.clearInterval(id);},[otpRemaining]);
  useEffect(()=>{if(!resendRemaining)return;const id=window.setInterval(()=>setResendRemaining(v=>Math.max(0,v-1)),1000);return()=>window.clearInterval(id);},[resendRemaining]);

  const passwordChecks=useMemo(()=>passwordGuidance(password),[password]);
  const otpTime=useMemo(()=>{const m=Math.floor(otpRemaining/60).toString().padStart(2,'0');const s=(otpRemaining%60).toString().padStart(2,'0');return `${m}:${s}`;},[otpRemaining]);

  const sendOtp=async()=>{
    setError('');setMessage('');
    if(!validPhone(phone)){setError('Enter exactly 11 digits for your Nigerian phone number, for example 08012345678.');return;}
    setLoading(true);
    try{
      const r=await fetch('/api/auth/unique-otp/registration/request',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({phone})});
      const b=await r.json();
      if(!r.ok)throw new Error(b?.error?.message||'We could not send your UniqueOTP.');
      setOtpRemaining(Number(b.expiresInSeconds)||300);setResendRemaining(Number(b.resendAfterSeconds)||30);setStep('phone');setMessage('UniqueOTP sent. Check your SMS and enter the 6-digit code.');
    }catch(e:any){setError(e.message||'Unable to send UniqueOTP.');}finally{setLoading(false);}
  };

  const verifyOtp=async()=>{
    setError('');setMessage('');
    if(otpRemaining<=0){setError('Your UniqueOTP has expired. Request a new code.');return;}
    if(!/^\d{6}$/.test(code)){setError('Enter the 6-digit UniqueOTP.');return;}
    setLoading(true);
    try{
      const r=await fetch('/api/auth/unique-otp/registration/verify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({phone,code})});
      const b=await r.json();
      if(!r.ok)throw new Error(b?.error?.message||'The UniqueOTP could not be verified.');
      setRegistrationToken(b.registrationToken);setStep('details');setMessage('Phone verified. Your Unique ID will be the 10-digit phone number without the first 0.');
    }catch(e:any){setError(e.message||'Verification failed.');}finally{setLoading(false);}
  };

  const continueDetails=()=>{
    setError('');
    if(!firstName.trim()||!lastName.trim()){setError('Enter your first name and last name.');return;}
    if(email&&(!/^\S+@\S+\.\S+$/.test(email.trim()))){setError('Enter a valid email address or leave it blank.');return;}
    if(!state||!lga.trim()||!town.trim()||!area.trim()||!fullAddress.trim()){setError('Complete your location and full address.');return;}
    if(nin && !/^\d{11}$/.test(nin)){setError('NIN must be exactly 11 digits, or leave it blank.');return;}
    if(bvn && !/^\d{11}$/.test(bvn)){setError('BVN must be exactly 11 digits, or leave it blank.');return;}
    setStep('security');
  };

  const complete=async()=>{
    setError('');
    if(!/^\d{6}$/.test(password)||weakLoginPins.has(password)){setError('Choose a 6-digit login PIN that is not an obvious pattern.');return;}
    if(password!==confirmPassword){setError('Your 6-digit login PINs do not match.');return;}
    if(!/^\d{4}$/.test(transactionPin)||weakTransactionPins.has(transactionPin)){setError('Choose a 4-digit Transaction PIN that is not an obvious pattern.');return;}
    if(transactionPin!==confirmTransactionPin){setError('Your 4-digit Transaction PINs do not match.');return;}
    setLoading(true);
    try{
      const r=await fetch('/api/auth/unique-otp/registration/complete',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({registrationToken,password,confirmPassword,transactionPin,confirmTransactionPin,firstName,otherName,lastName,email,country:'Nigeria',state,lga,town,area,fullAddress,landmark,nin,bvn})});
      const b=await r.json();
      if(!r.ok)throw new Error(b?.error?.message||'Registration could not be completed.');
      setMessage(`Account created. Your Unique ID is ${b.uniqueOneId}.`);
      navigate('/login',{replace:true,state:{from:location.state?.from||undefined,message:`Your Unique One account is ready. Unique ID: ${b.uniqueOneId}. You can sign in with your phone number or Unique ID.`}});
    }catch(e:any){setError(e.message||'Registration could not be completed.');}finally{setLoading(false);}
  };

  return <div className="register-page min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-8 sm:py-10"><div className="w-full max-w-2xl bg-white rounded-3xl p-5 sm:p-8 shadow-xl border border-slate-100">
    <div className="text-center mb-7"><div className="inline-flex rounded-full bg-slate-900 text-white px-4 py-2 text-xs font-semibold tracking-wide mb-4">UNIQUEPLATFORM • UNIQUE ID • UNIQUEPAY</div><h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900">Create your UniquePlatform account</h1><p className="text-sm sm:text-base text-slate-500 mt-2 max-w-lg mx-auto">Set up your verified identity, profile and payment security in three simple steps.</p></div>
    <div className="grid grid-cols-3 gap-2 mb-7 text-xs font-medium"><span className={`rounded-xl px-3 py-2.5 text-center ${step==='phone'?'bg-green-100 text-green-700':'bg-slate-100 text-slate-500'}`}>1. Phone</span><span className={`flex-1 rounded-full px-3 py-2 text-center ${step==='details'?'bg-green-100 text-green-700':'bg-slate-100 text-slate-500'}`}>2. Details</span><span className={`flex-1 rounded-full px-3 py-2 text-center ${step==='security'?'bg-green-100 text-green-700':'bg-slate-100 text-slate-500'}`}>3. Security</span></div>
    {error&&<div className="mb-4 p-3 bg-red-50 border border-red-100 text-red-700 rounded-xl text-sm">{error}</div>}
    {message&&<div className="mb-4 p-3 bg-green-50 border border-green-100 text-green-700 rounded-xl text-sm">{message}</div>}

    {step==='phone'&&<div className="space-y-5">
      <div><label className="text-sm font-medium text-slate-700">Nigerian phone number</label><div className="relative mt-1"><Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400"/><input type="tel" inputMode="numeric" maxLength={11} value={phone} onChange={e=>setPhone(e.target.value.replace(/\D/g,''))} className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl" placeholder="08012345678" autoComplete="tel" required/></div><p className="text-xs text-slate-500 mt-1">Exactly 11 digits. This becomes your Unique ID after verification, without the first 0.</p></div>
      {otpRemaining>0&&<div className="rounded-2xl bg-slate-50 border border-slate-200 p-4"><p className="font-semibold text-slate-900">Enter your UniqueOTP</p><p className="text-sm text-slate-500 mt-1">Code expires in <span className="font-semibold text-slate-900">{otpTime}</span>.</p><input inputMode="numeric" maxLength={6} value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,''))} className="w-full mt-3 text-center tracking-[0.5em] text-xl py-3 border border-slate-200 rounded-xl bg-white" placeholder="••••••" autoComplete="one-time-code"/><button onClick={verifyOtp} disabled={loading||otpRemaining<=0} className="w-full mt-3 bg-green-600 text-white rounded-xl py-3 font-semibold">{loading?'Verifying...':'Verify UniqueOTP'}</button><button type="button" onClick={sendOtp} disabled={loading||resendRemaining>0} className="w-full mt-2 py-2 text-sm font-semibold text-slate-700 disabled:text-slate-400">{resendRemaining>0?`Resend in ${resendRemaining}s`:'Resend UniqueOTP'}</button></div>}
      {otpRemaining===0&&<button onClick={sendOtp} disabled={loading} className="w-full bg-green-600 text-white rounded-xl py-3 font-semibold flex items-center justify-center gap-2">{loading?<Loader2 className="w-5 h-5 animate-spin"/>:<>Send UniqueOTP <ChevronRight className="w-4 h-4"/></>}</button>}
    </div>}

    {step==='details'&&<div className="space-y-4">
      <div className="rounded-2xl bg-green-50 border border-green-100 p-4 text-sm text-green-800"><ShieldCheck className="inline w-4 h-4 mr-1"/> Phone verified. Unique ID: <strong>{phone.slice(1)}</strong></div>
      <div className="grid sm:grid-cols-2 gap-4"><div><label className="text-sm font-medium text-slate-700">First Name *</label><input value={firstName} onChange={e=>setFirstName(e.target.value)} className="w-full mt-1 px-4 py-3 border border-slate-200 rounded-xl" autoComplete="given-name"/></div><div><label className="text-sm font-medium text-slate-700">Last Name *</label><input value={lastName} onChange={e=>setLastName(e.target.value)} className="w-full mt-1 px-4 py-3 border border-slate-200 rounded-xl" autoComplete="family-name"/></div></div>
      <div><label className="text-sm font-medium text-slate-700">Other / Middle Name</label><input value={otherName} onChange={e=>setOtherName(e.target.value)} className="w-full mt-1 px-4 py-3 border border-slate-200 rounded-xl"/></div>
      <div><label className="text-sm font-medium text-slate-700">Email Address <span className="text-slate-400">(Optional)</span></label><div className="relative mt-1"><Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400"/><input type="email" value={email} onChange={e=>setEmail(e.target.value)} className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl" placeholder="you@example.com" autoComplete="email"/></div><p className="text-xs text-slate-500 mt-1">If you add it, we will verify it with UniqueOTP before it can be used as a login identifier.</p></div>
      <div className="pt-2 border-t border-slate-100"><p className="font-semibold text-slate-900 mb-3 flex items-center gap-2"><MapPin className="w-4 h-4"/> Location & shipping address</p><div><label className="text-sm font-medium text-slate-700">Country</label><input value="Nigeria" disabled className="w-full mt-1 px-4 py-3 border border-slate-200 rounded-xl bg-slate-50"/></div><div className="grid sm:grid-cols-2 gap-4 mt-4"><div><label className="text-sm font-medium text-slate-700">State *</label><select value={state} onChange={e=>setState(e.target.value)} className="w-full mt-1 px-4 py-3 border border-slate-200 rounded-xl bg-white"><option value="">Select State</option>{NIGERIAN_STATES.map(item=><option key={item} value={item}>{item}</option>)}</select></div><div><label className="text-sm font-medium text-slate-700">Local Government Area *</label><input value={lga} onChange={e=>setLga(e.target.value)} className="w-full mt-1 px-4 py-3 border border-slate-200 rounded-xl" placeholder="Enter your LGA"/></div><div><label className="text-sm font-medium text-slate-700">Town / City *</label><input value={town} onChange={e=>setTown(e.target.value)} className="w-full mt-1 px-4 py-3 border border-slate-200 rounded-xl"/></div><div><label className="text-sm font-medium text-slate-700">Area *</label><input value={area} onChange={e=>setArea(e.target.value)} className="w-full mt-1 px-4 py-3 border border-slate-200 rounded-xl"/></div></div><div className="mt-4"><label className="text-sm font-medium text-slate-700">Full Address *</label><textarea value={fullAddress} onChange={e=>setFullAddress(e.target.value)} rows={3} className="w-full mt-1 px-4 py-3 border border-slate-200 rounded-xl resize-none" placeholder="House number, street name, etc."/></div><div className="mt-4"><label className="text-sm font-medium text-slate-700">Landmark <span className="text-slate-400">(Optional)</span></label><input value={landmark} onChange={e=>setLandmark(e.target.value)} className="w-full mt-1 px-4 py-3 border border-slate-200 rounded-xl"/></div></div>
      <div className="pt-3 border-t border-slate-100">
        <p className="font-semibold text-slate-900 mb-2">Identity information <span className="text-slate-400 font-normal">(Optional)</span></p>
        <p className="text-xs text-slate-500 mb-3">You can provide your NIN or BVN now, or add and verify them later in the Verification Center. They are protected from ordinary profile editing.</p>
        <div className="grid sm:grid-cols-2 gap-4">
          <div><label className="text-sm font-medium text-slate-700">NIN</label><input inputMode="numeric" maxLength={11} value={nin} onChange={e=>setNin(e.target.value.replace(/\D/g,'').slice(0,11))} className="w-full mt-1 px-4 py-3 border border-slate-200 rounded-xl" placeholder="11-digit NIN"/></div>
          <div><label className="text-sm font-medium text-slate-700">BVN</label><input inputMode="numeric" maxLength={11} value={bvn} onChange={e=>setBvn(e.target.value.replace(/\D/g,'').slice(0,11))} className="w-full mt-1 px-4 py-3 border border-slate-200 rounded-xl" placeholder="11-digit BVN"/></div>
        </div>
      </div>
      <div className="flex gap-3"><button type="button" onClick={()=>{setStep('phone');setMessage('Phone verification is complete.');}} className="flex-1 py-3 rounded-xl border border-slate-200 font-semibold flex items-center justify-center gap-2"><ChevronLeft className="w-4 h-4"/>Back</button><button type="button" onClick={continueDetails} className="flex-1 bg-green-600 text-white rounded-xl py-3 font-semibold flex items-center justify-center gap-2">Continue <ChevronRight className="w-4 h-4"/></button></div>
    </div>}

    {step==='security'&&<div className="space-y-4">
      <div><label className="text-sm font-medium text-slate-700">6-digit Login PIN *</label><div className="relative mt-1"><Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400"/><input type="password" inputMode="numeric" maxLength={6} value={password} onChange={e=>setPassword(e.target.value.replace(/\D/g,''))} className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl" placeholder="••••••" autoComplete="new-password"/></div><div className="mt-2 space-y-1">{passwordChecks.map(item=><p key={item.label} className={`text-xs ${item.ok?'text-green-600':'text-slate-500'}`}>{item.ok?'✓':'○'} {item.label}</p>)}</div></div>
      <div><label className="text-sm font-medium text-slate-700">Confirm Login PIN *</label><input type="password" inputMode="numeric" maxLength={6} value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value.replace(/\D/g,''))} className="w-full mt-1 px-4 py-3 border border-slate-200 rounded-xl" autoComplete="new-password"/></div>
      <div className="pt-3 border-t border-slate-100"><label className="text-sm font-medium text-slate-700">4-digit Transaction PIN *</label><input type="password" inputMode="numeric" maxLength={4} value={transactionPin} onChange={e=>setTransactionPin(e.target.value.replace(/\D/g,''))} className="w-full mt-1 px-4 py-3 border border-slate-200 rounded-xl" placeholder="••••" autoComplete="new-password"/><p className="text-xs text-slate-500 mt-1">Used for payments and transfers. It is separate from your 6-digit Login PIN.</p></div>
      <div><label className="text-sm font-medium text-slate-700">Confirm Transaction PIN *</label><input type="password" inputMode="numeric" maxLength={4} value={confirmTransactionPin} onChange={e=>setConfirmTransactionPin(e.target.value.replace(/\D/g,''))} className="w-full mt-1 px-4 py-3 border border-slate-200 rounded-xl"/></div>
      <div className="flex gap-3"><button type="button" onClick={()=>setStep('details')} className="flex-1 py-3 rounded-xl border border-slate-200 font-semibold flex items-center justify-center gap-2"><ChevronLeft className="w-4 h-4"/>Back</button><button type="button" onClick={complete} disabled={loading} className="flex-1 bg-green-600 text-white rounded-xl py-3 font-semibold flex items-center justify-center gap-2">{loading?<Loader2 className="w-5 h-5 animate-spin"/>:<>Create account <ShieldCheck className="w-4 h-4"/></>}</button></div>
    </div>}
    <p className="text-center text-sm text-slate-600 mt-6">Already have an account? <Link to="/login" className="font-semibold text-slate-900">Log in</Link></p>
  </div></div>;
}
