import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

const KERALA_DISTRICTS = [
  'Alappuzha', 'Ernakulam', 'Idukki', 'Kannur', 'Kasaragod',
  'Kollam', 'Kottayam', 'Kozhikode', 'Malappuram', 'Palakkad',
  'Pathanamthitta', 'Thiruvananthapuram', 'Thrissur', 'Wayanad'
];

const BLOOD_GROUPS = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'];

const COMPATIBLE_DONORS = {
  'O-': ['O-'],
  'O+': ['O+', 'O-'],
  'A-': ['A-', 'O-'],
  'A+': ['A+', 'A-', 'O+', 'O-'],
  'B-': ['B-', 'O-'],
  'B+': ['B+', 'B-', 'O+', 'O-'],
  'AB-': ['AB-', 'A-', 'B-', 'O-'],
  'AB+': ['AB+', 'AB-', 'A+', 'A-', 'B+', 'B-', 'O+', 'O-'],
};

export default function App() {
  // Navigation & Persona Switcher States
  const [activeNav, setActiveNav] = useState('Requests'); // 'Active Matches' | 'Volunteer Register' | 'Requests' | 'Reserves'
  const [district, setDistrict] = useState('Ernakulam');
  const [persona, setPersona] = useState('recipient'); // 'recipient' | 'donor'
  const [activeDonorId, setActiveDonorId] = useState('');

  // District Reserves State (Correctly positioned inside App)
  const [districtReserves, setDistrictReserves] = useState({});

  // Hospital / Recipient Request Form States
  const [patientName, setPatientName] = useState('Aditya Ramesh #ER-88421');
  const [hospital, setHospital] = useState('Aster Medcity, South Trauma Wing');
  const [selectedGroup, setSelectedGroup] = useState('O+');
  const [units, setUnits] = useState(2);

  // Application Lifecycle & Single Match States
  const [activeRequestId, setActiveRequestId] = useState(null);
  const [donors, setDonors] = useState([]);
  const [matchedDonor, setMatchedDonor] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  // Register Donor Form States
  const [regName, setRegName] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regGroup, setRegGroup] = useState('O+');
  const [regDistrict, setRegDistrict] = useState('Ernakulam');
  const [regDaysAgo, setRegDaysAgo] = useState(100);
  const [regStatus, setRegStatus] = useState('');

  // Fetch masked donors compatible with the selected blood group in the chosen district
  const fetchDonors = async (requestedGroup, currentDistrict) => {
    try {
      const compatibleGroups = COMPATIBLE_DONORS[requestedGroup] || [requestedGroup];

      const { data, error } = await supabase
        .from('public_eligible_donors')
        .select('*')
        .in('blood_group', compatibleGroups)
        .eq('district', currentDistrict);

      if (error) throw error;
      setDonors(data || []);

      if (data && data.length > 0) {
        setActiveDonorId(data[0].id);
      } else {
        setActiveDonorId('');
      }
    } catch (err) {
      console.error('Error fetching compatible donors:', err.message);
    }
  };

  // Fetch full aggregate count across all blood types for the selected district
  const fetchDistrictReserves = async (currentDistrict) => {
    try {
      const { data, error } = await supabase
        .from('public_eligible_donors')
        .select('blood_group, is_eligible')
        .eq('district', currentDistrict);

      if (error) throw error;

      const counts = {};
      BLOOD_GROUPS.forEach((bg) => {
        counts[bg] = { total: 0, eligible: 0 };
      });

      (data || []).forEach((d) => {
        if (counts[d.blood_group]) {
          counts[d.blood_group].total += 1;
          if (d.is_eligible) {
            counts[d.blood_group].eligible += 1;
          }
        }
      });

      setDistrictReserves(counts);
    } catch (err) {
      console.error('Error fetching district reserves:', err.message);
    }
  };

  // Synchronize both donors and reserves whenever blood group or district changes
  useEffect(() => {
    fetchDonors(selectedGroup, district);
    fetchDistrictReserves(district);
    setMatchedDonor(null);
  }, [selectedGroup, district]);

  useEffect(() => {
    if (donors.length > 0 && (!activeDonorId || !donors.find((d) => d.id === activeDonorId))) {
      setActiveDonorId(donors[0].id);
    }
  }, [donors]);

  // Broadcast emergency request (Only on Requests page)
  const handleBroadcast = async (e) => {
    e.preventDefault();
    setLoading(true);
    setStatusMessage('');
    setMatchedDonor(null);

    try {
      const { data, error } = await supabase
        .from('requests')
        .insert([
          {
            patient_name: patientName,
            hospital_name: hospital,
            blood_group: selectedGroup,
            district: district,
            status: 'PENDING'
          }
        ])
        .select()
        .single();

      if (error) throw error;

      setActiveRequestId(data.id);

      const eligibleCount = donors.filter((d) => d.is_eligible).length;
      const newNotification = {
        id: Date.now(),
        title: `🚨 Emergency Alert Sent (${selectedGroup} in ${district})`,
        message: `High-priority ping dispatched to ${eligibleCount} compatible eligible donors in ${district}.`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setNotifications((prev) => [newNotification, ...prev]);
      setStatusMessage(`Request #${data.id.slice(0, 8)} broadcasted across ${district}!`);
    } catch (err) {
      alert('Broadcast Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Donor Acceptance Handler
  const handleAcceptDonation = async (donor) => {
    if (!activeRequestId) {
      alert('No active request. Please broadcast a request from the Recipient View first.');
      return;
    }

    try {
      const { data: realPhone, error } = await supabase.rpc('accept_donation_request', {
        p_request_id: activeRequestId,
        p_donor_id: donor.id
      });

      if (error) throw error;

      setMatchedDonor({
        id: donor.id,
        name: donor.name,
        phone: realPhone
      });

      setStatusMessage(`✓ Request Fulfilled! ${donor.name} accepted.`);
    } catch (err) {
      alert('Acceptance failed: ' + err.message);
    }
  };

  // Donor Self-Registration Handler
  const handleRegisterDonor = async (e) => {
    e.preventDefault();
    setRegStatus('Registering...');
    try {
      const donationDate = new Date(Date.now() - regDaysAgo * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const { error } = await supabase.from('donors').insert([
        {
          name: regName,
          phone: regPhone,
          blood_group: regGroup,
          district: regDistrict,
          last_donation_date: donationDate
        }
      ]);

      if (error) throw error;

      setRegStatus(`✓ Donor ${regName} registered in ${regDistrict} successfully!`);
      setRegName('');
      setRegPhone('');
      fetchDonors(selectedGroup, district);
      fetchDistrictReserves(district);
    } catch (err) {
      setRegStatus('Registration Error: ' + err.message);
    }
  };

  const currentDonor = donors.find((d) => d.id === activeDonorId) || donors[0];

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Top Banner with Background */}
      <div className="wave-canvas">
        <header
          style={{
            position: 'relative',
            zIndex: 10,
            maxWidth: '1200px',
            margin: '0 auto',
            padding: '24px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '16px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <span
              style={{
                fontFamily: 'Cormorant Garamond, serif',
                fontSize: '32px',
                fontWeight: 700,
                color: '#1E1919',
                cursor: 'pointer'
              }}
              onClick={() => setActiveNav('Requests')}
            >
              RedLine
            </span>

            {/* District Selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 600 }}>📍</span>
              <select
                className="storybook-input"
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                style={{ padding: '4px 8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
              >
                {KERALA_DISTRICTS.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Navigation Items */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <nav style={{ display: 'flex', gap: '18px' }}>
              {[
                { label: 'Matches', key: 'Active Matches' },
                { label: 'Volunteer Register', key: 'Volunteer Register' },
                { label: 'Requests', key: 'Requests' },
                { label: 'Reserves', key: 'Reserves' },
              ].map((item) => {
                const isActive = activeNav === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setActiveNav(item.key)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: isActive ? '#FFFFFF' : 'rgba(255, 255, 255, 0.85)',
                      fontSize: '13px',
                      fontWeight: isActive ? 700 : 500,
                      cursor: 'pointer',
                      borderBottom: isActive ? '2px solid #FFFFFF' : 'none',
                      paddingBottom: '2px',
                      transition: 'all 0.2s'
                    }}
                  >
                    {item.label}
                  </button>
                );
              })}
            </nav>

            {/* Persona Switcher */}
            <div
              style={{
                background: 'rgba(255, 255, 255, 0.15)',
                backdropFilter: 'blur(8px)',
                borderRadius: '20px',
                padding: '4px 6px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <button
                type="button"
                onClick={() => setPersona('recipient')}
                style={{
                  background: persona === 'recipient' ? '#FFFFFF' : 'transparent',
                  color: persona === 'recipient' ? 'var(--crimson-bright)' : '#FFFFFF',
                  border: 'none',
                  borderRadius: '16px',
                  padding: '4px 10px',
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                🏥 Recipient
              </button>
              <button
                type="button"
                onClick={() => setPersona('donor')}
                style={{
                  background: persona === 'donor' ? '#FFFFFF' : 'transparent',
                  color: persona === 'donor' ? 'var(--crimson-bright)' : '#FFFFFF',
                  border: 'none',
                  borderRadius: '16px',
                  padding: '4px 10px',
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                👤 Donor
              </button>

              {persona === 'donor' && donors.length > 0 && (
                <select
                  value={activeDonorId}
                  onChange={(e) => setActiveDonorId(e.target.value)}
                  style={{
                    background: 'rgba(255, 255, 255, 0.9)',
                    border: 'none',
                    borderRadius: '12px',
                    padding: '2px 8px',
                    fontSize: '11px',
                    color: 'var(--obsidian)',
                    outline: 'none'
                  }}
                >
                  {donors.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.blood_group})
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>
        </header>

        {/* Hero Section */}
        <div
          style={{
            position: 'relative',
            zIndex: 10,
            maxWidth: '1200px',
            margin: '0 auto',
            padding: '20px 24px 60px 24px',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            alignItems: 'center',
            gap: '40px'
          }}
        >
          {/* Left Title Text */}
          <div>
            <h1
              style={{
                fontFamily: 'Cormorant Garamond, serif',
                fontSize: '52px',
                lineHeight: 1.1,
                fontWeight: 600,
                color: 'var(--obsidian)',
                margin: '0 0 16px 0',
                maxWidth: '460px'
              }}
            >
              Emergency Blood Donor Matching App
            </h1>
            <p style={{ fontSize: '17px', color: 'var(--muted)', margin: 0, fontWeight: 400 }}>
              Privacy-first emergency blood donor matching.
            </p>

            {/* Notification Alert Ticker: ONLY shown on Requests page */}
            {activeNav === 'Requests' && persona === 'recipient' && notifications.length > 0 && (
              <div
                style={{
                  marginTop: '28px',
                  padding: '12px 18px',
                  background: '#FFFFFF',
                  borderRadius: '12px',
                  borderLeft: '4px solid var(--sand-tint)',
                  boxShadow: '0 4px 14px rgba(0, 0, 0, 0.04)',
                  maxWidth: '380px'
                }}
              >
                <div style={{ fontWeight: 700, fontSize: '12px', color: 'var(--crimson-bright)' }}>
                  {notifications[0].title}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>
                  {notifications[0].message}
                </div>
              </div>
            )}
          </div>

          {/* Right Floating Content Card */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            
            {/* 1. REQUESTS PAGE (Recipient Form) */}
            {activeNav === 'Requests' && persona === 'recipient' && (
              <>
                <form
                  onSubmit={handleBroadcast}
                  className="storybook-card"
                  style={{ width: '100%', maxWidth: '460px', padding: '28px 30px' }}
                >
                  <div style={{ marginBottom: '14px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--obsidian)', display: 'block', marginBottom: '6px' }}>
                      Patient/MRN Identification
                    </label>
                    <input
                      type="text"
                      className="storybook-input"
                      value={patientName}
                      onChange={(e) => setPatientName(e.target.value)}
                      placeholder="Patient/MRN Identification"
                      style={{ width: '100%' }}
                      required
                    />
                  </div>

                  <div style={{ marginBottom: '18px' }}>
                    <select
                      className="storybook-input"
                      value={hospital}
                      onChange={(e) => setHospital(e.target.value)}
                      style={{ width: '100%', cursor: 'pointer' }}
                      required
                    >
                      <option value="Aster Medcity, South Trauma Wing">Aster Medcity, South Trauma Wing</option>
                      <option value="General Hospital Ernakulam">General Hospital Ernakulam</option>
                      <option value="Lisie Hospital Cardiology Wing">Lisie Hospital Cardiology Wing</option>
                      <option value="Medical Trust Emergency Unit">Medical Trust Emergency Unit</option>
                    </select>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--obsidian)' }}>Units Needed:</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button type="button" className="blood-pill" style={{ padding: '3px 10px' }} onClick={() => setUnits(Math.max(1, units - 1))}>-</button>
                      <span style={{ fontWeight: 700, fontSize: '13px', minWidth: '45px', textAlign: 'center' }}>{units} Units</span>
                      <button type="button" className="blood-pill" style={{ padding: '3px 10px' }} onClick={() => setUnits(units + 1)}>+</button>
                    </div>
                  </div>

                  <div style={{ marginBottom: '8px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--obsidian)', display: 'block', marginBottom: '8px' }}>
                      Requested Blood Group
                    </label>
                    <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px' }}>
                      {BLOOD_GROUPS.map((group) => (
                        <button
                          key={group}
                          type="button"
                          onClick={() => setSelectedGroup(group)}
                          className={`blood-pill ${selectedGroup === group ? 'blood-pill-active' : ''}`}
                        >
                          {group}
                        </button>
                      ))}
                    </div>
                  </div>

                  {statusMessage && (
                    <div style={{ fontSize: '11px', color: 'var(--crimson-bright)', fontWeight: 600, marginTop: '10px', textAlign: 'center' }}>
                      {statusMessage}
                    </div>
                  )}
                </form>

                <div style={{ marginTop: '20px' }}>
                  <button type="button" disabled={loading} onClick={handleBroadcast} className="storybook-broadcast-btn">
                    {loading ? 'Broadcasting...' : 'Broadcast Request'}
                  </button>
                </div>
              </>
            )}

            {/* 2. DONOR PERSONA VIEW */}
            {persona === 'donor' && (
              <div className="storybook-card" style={{ width: '100%', maxWidth: '460px', padding: '28px 30px' }}>
                <span style={{ fontSize: '10px', letterSpacing: '1px', color: 'var(--sand-tint)', fontWeight: 700 }}>
                  DONOR HEALTH PASSPORT
                </span>
                <h3 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '26px', margin: '4px 0 12px 0' }}>
                  {currentDonor ? currentDonor.name : 'Select Donor'}
                </h3>

                {currentDonor ? (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                      <div className="storybook-input" style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '10px', color: 'var(--muted)' }}>BLOOD GROUP</div>
                        <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--crimson-bright)' }}>{currentDonor.blood_group}</div>
                      </div>
                      <div className="storybook-input" style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '10px', color: 'var(--muted)' }}>LAST DONATION</div>
                        <div style={{ fontSize: '16px', fontWeight: 700 }}>{currentDonor.days_since_donation}d ago</div>
                      </div>
                    </div>

                    <div style={{ marginBottom: '16px', textAlign: 'center' }}>
                      <span style={{ fontSize: '11px', fontWeight: 600, color: currentDonor.is_eligible ? '#2B7A4B' : 'var(--crimson-bright)' }}>
                        {currentDonor.is_eligible ? '✓ 90-Day Interval Met (Ready to donate)' : `🔒 In Cooldown (${90 - currentDonor.days_since_donation}d left)`}
                      </span>
                    </div>

                    {activeRequestId && !matchedDonor && currentDonor.is_eligible && (COMPATIBLE_DONORS[selectedGroup] || []).includes(currentDonor.blood_group) ? (
                      <button
                        type="button"
                        onClick={() => handleAcceptDonation(currentDonor)}
                        className="storybook-broadcast-btn"
                        style={{ width: '100%', background: 'var(--crimson-bright)', color: '#FFFFFF' }}
                      >
                        ✓ Accept & Share My Number
                      </button>
                    ) : matchedDonor?.id === currentDonor.id ? (
                      <div style={{ textAlign: 'center', fontSize: '12px', color: '#2B7A4B', fontWeight: 700 }}>
                        ✓ You accepted this request! Contact shared.
                      </div>
                    ) : (
                      <div style={{ textAlign: 'center', fontSize: '11px', color: 'var(--muted)' }}>
                        No pending dispatch matching your blood group.
                      </div>
                    )}
                  </>
                ) : (
                  <div style={{ textAlign: 'center', fontSize: '12px', color: 'var(--muted)' }}>
                    No registered donor found in {district}.
                  </div>
                )}
              </div>
            )}

            {/* 3. ACTIVE MATCHES PAGE */}
            {activeNav === 'Active Matches' && persona === 'recipient' && (
              <div className="storybook-card" style={{ width: '100%', maxWidth: '460px', padding: '28px 30px' }}>
                <span style={{ fontSize: '10px', letterSpacing: '1px', color: 'var(--sand-tint)', fontWeight: 700 }}>
                  TRIAGE AUDIT LOGS
                </span>
                <h3 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '26px', margin: '4px 0 16px 0' }}>
                  Active Matches
                </h3>

                {!matchedDonor ? (
                  <div style={{ textAlign: 'center', color: 'var(--muted)', padding: '24px 0', fontSize: '13px' }}>
                    No donor handshakes confirmed yet in {district}. Go to Requests to initiate a triage.
                  </div>
                ) : (
                  <div style={{ padding: '14px 16px', background: '#ECE9DF', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <strong style={{ color: 'var(--crimson-bright)', fontSize: '14px' }}>{matchedDonor.name}</strong>
                      <div style={{ fontSize: '11px', color: 'var(--muted)' }}>Ticket #{activeRequestId?.slice(0, 8)} • Mutual Accept</div>
                    </div>
                    <a href={`tel:${matchedDonor.phone}`} style={{ fontWeight: 700, color: 'var(--crimson-bright)', fontSize: '13px', textDecoration: 'none' }}>
                      📞 {matchedDonor.phone}
                    </a>
                  </div>
                )}
              </div>
            )}

            {/* 4. RESERVES PAGE: Accurately counts all blood groups */}
            {activeNav === 'Reserves' && persona === 'recipient' && (
              <div className="storybook-card" style={{ width: '100%', maxWidth: '460px', padding: '28px 30px' }}>
                <span style={{ fontSize: '10px', letterSpacing: '1px', color: 'var(--sand-tint)', fontWeight: 700 }}>
                  REGIONAL CAPACITY
                </span>
                <h3 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '26px', margin: '4px 0 16px 0' }}>
                  {district} Reserves
                </h3>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
                  {BLOOD_GROUPS.map((bg) => {
                    const stats = districtReserves[bg] || { total: 0, eligible: 0 };
                    return (
                      <div key={bg} className="storybook-input" style={{ textAlign: 'center', padding: '10px 4px' }}>
                        <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--crimson-bright)' }}>{bg}</div>
                        <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--obsidian)', marginTop: '2px' }}>
                          {stats.eligible} Active
                        </div>
                        <div style={{ fontSize: '9px', color: 'var(--muted)' }}>
                          {stats.total} Registered
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 5. VOLUNTEER REGISTER PAGE */}
            {activeNav === 'Volunteer Register' && persona === 'recipient' && (
              <form onSubmit={handleRegisterDonor} className="storybook-card" style={{ width: '100%', maxWidth: '460px', padding: '28px 30px' }}>
                <span style={{ fontSize: '10px', letterSpacing: '1px', color: 'var(--sand-tint)', fontWeight: 700 }}>
                  VOLUNTEER ONBOARDING
                </span>
                <h3 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '26px', margin: '4px 0 14px 0' }}>
                  Register as Donor
                </h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <input
                    type="text"
                    className="storybook-input"
                    placeholder="Full Name"
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    required
                  />

                  <input
                    type="tel"
                    className="storybook-input"
                    placeholder="Private Phone Number"
                    value={regPhone}
                    onChange={(e) => setRegPhone(e.target.value)}
                    required
                  />

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <select
                      className="storybook-input"
                      value={regDistrict}
                      onChange={(e) => setRegDistrict(e.target.value)}
                    >
                      {KERALA_DISTRICTS.map((d) => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>

                    <select
                      className="storybook-input"
                      value={regGroup}
                      onChange={(e) => setRegGroup(e.target.value)}
                    >
                      {BLOOD_GROUPS.map((g) => (
                        <option key={g} value={g}>{g}</option>
                      ))}
                    </select>
                  </div>

                  <input
                    type="number"
                    className="storybook-input"
                    placeholder="Last donation (days ago)"
                    value={regDaysAgo}
                    onChange={(e) => setRegDaysAgo(Number(e.target.value))}
                    min="0"
                    required
                  />

                  <button
                    type="submit"
                    className="storybook-broadcast-btn"
                    style={{ background: 'var(--crimson-bright)', color: '#FFFFFF', marginTop: '6px' }}
                  >
                    Register Donor
                  </button>

                  {regStatus && (
                    <div style={{ fontSize: '11px', color: 'var(--crimson-bright)', fontWeight: 600, textAlign: 'center' }}>
                      {regStatus}
                    </div>
                  )}
                </div>
              </form>
            )}

          </div>
        </div>
      </div>

      {/* Bottom Area: Matched Donors (ONLY rendered on the Requests page in recipient mode) */}
      {activeNav === 'Requests' && persona === 'recipient' && (
        <div style={{ flex: 1, maxWidth: '1200px', margin: '0 auto', width: '100%', padding: '40px 24px' }}>
          <section>
            <div style={{ textAlign: 'center', marginBottom: '32px' }}>
              <h2
                style={{
                  fontFamily: 'Cormorant Garamond, serif',
                  fontSize: '34px',
                  fontWeight: 600,
                  margin: '0 0 6px 0',
                  color: 'var(--obsidian)'
                }}
              >
                Matched Donors
              </h2>
              <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
                Showing compatible volunteers for {selectedGroup} in {district} • Masked Privacy Protocol
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px' }}>
              {donors.length === 0 ? (
                <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '36px', color: 'var(--muted)' }}>
                  No compatible donors found for {selectedGroup} in {district}.
                </div>
              ) : (
                donors.map((donor) => {
                  const isAcceptedByThisDonor = matchedDonor?.id === donor.id;
                  const isOtherDonorAccepted = Boolean(matchedDonor && !isAcceptedByThisDonor);

                  return (
                    <div
                      key={donor.id}
                      className="donor-card-story"
                      style={{
                        opacity: !donor.is_eligible || isOtherDonorAccepted ? 0.6 : 1,
                        border: isAcceptedByThisDonor ? '1.5px solid var(--crimson-bright)' : '1px solid rgba(0,0,0,0.05)'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '8px' }}>
                        <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--obsidian)' }}>
                          {donor.name} <span style={{ fontWeight: 400, color: 'var(--muted)' }}>| {donor.blood_group}</span>
                        </div>
                        <span style={{ fontSize: '11px', color: 'var(--muted)' }}>{donor.district}</span>
                      </div>

                      <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '2px' }}>
                        Masked Number
                      </div>
                      <div
                        style={{
                          fontSize: '13px',
                          fontWeight: 700,
                          color: isAcceptedByThisDonor ? 'var(--crimson-bright)' : 'var(--obsidian)',
                          fontFamily: 'monospace',
                          marginBottom: '12px'
                        }}
                      >
                        {isAcceptedByThisDonor ? matchedDonor.phone : donor.masked_phone}
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(0,0,0,0.04)', paddingTop: '10px' }}>
                        <span style={{ fontSize: '11px', fontWeight: 600, color: donor.is_eligible ? '#2B7A4B' : 'var(--sand-tint)' }}>
                          {donor.is_eligible ? 'Eligible' : `${90 - donor.days_since_donation}d lock`}
                        </span>

                        {isAcceptedByThisDonor ? (
                          <a
                            href={`tel:${matchedDonor.phone}`}
                            style={{ fontSize: '11px', fontWeight: 700, color: 'var(--crimson-bright)', textDecoration: 'none' }}
                          >
                            📞 Direct Call
                          </a>
                        ) : isOtherDonorAccepted ? (
                          <span style={{ fontSize: '10px', color: 'var(--muted)' }}>Fulfilled</span>
                        ) : (
                          <span style={{ fontSize: '10px', color: 'var(--muted)' }}>Protected</span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}