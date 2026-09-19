import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

const KERALA_DISTRICTS = [
  'Alappuzha',
  'Ernakulam',
  'Idukki',
  'Kannur',
  'Kasaragod',
  'Kollam',
  'Kottayam',
  'Kozhikode',
  'Malappuram',
  'Palakkad',
  'Pathanamthitta',
  'Thiruvananthapuram',
  'Thrissur',
  'Wayanad'
];

const BLOOD_GROUPS = ['O+', 'O-', 'A+', 'A-', 'B+'];

export default function App() {
  // Navigation, District & Persona Switcher States
  const [activeTab, setActiveTab] = useState('Urgent Triage');
  const [district, setDistrict] = useState('Ernakulam');
  const [persona, setPersona] = useState('recipient'); // 'recipient' | 'donor'
  const [activeDonorId, setActiveDonorId] = useState('');

  // Hospital / Recipient Request Form States
  const [patientName, setPatientName] = useState('Aditya Ramesh #ER-88421');
  const [hospital, setHospital] = useState('Aster Medcity, South Trauma Wing');
  const [selectedGroup, setSelectedGroup] = useState('O+');
  const [units, setUnits] = useState(2);

  // Application Lifecycle & Single Match States
  const [activeRequestId, setActiveRequestId] = useState(null);
  const [donors, setDonors] = useState([]);
  const [matchedDonor, setMatchedDonor] = useState(null); // { id, name, phone }
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

  // 1. MATCH: Fetch masked donors matching current group & chosen district
  const fetchDonors = async (bloodGroup, currentDistrict) => {
    try {
      const { data, error } = await supabase
        .from('public_eligible_donors')
        .select('*')
        .eq('blood_group', bloodGroup)
        .eq('district', currentDistrict);

      if (error) throw error;
      setDonors(data || []);

      if (data && data.length > 0) {
        setActiveDonorId(data[0].id);
      } else {
        setActiveDonorId('');
      }
    } catch (err) {
      console.error('Error fetching donors:', err.message);
    }
  };

  // Re-fetch when blood group or district changes
  useEffect(() => {
    fetchDonors(selectedGroup, district);
    setMatchedDonor(null);
  }, [selectedGroup, district]);

  // Keep activeDonorId aligned when donor pool changes
  useEffect(() => {
    if (donors.length > 0 && (!activeDonorId || !donors.find((d) => d.id === activeDonorId))) {
      setActiveDonorId(donors[0].id);
    }
  }, [donors]);

  // 2. BROADCAST & NOTIFY: Recipient submits emergency request
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

      // Trigger simulated push alert to matched eligible donors in this district
      const eligibleCount = donors.filter((d) => d.is_eligible).length;
      const newNotification = {
        id: Date.now(),
        title: `🚨 Emergency Alert Sent (${selectedGroup} in ${district})`,
        message: `High-priority ping dispatched to ${eligibleCount} eligible donors in ${district}.`,
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

  // 3. ACCEPT: Triggered voluntarily by the donor
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

  // 4. REGISTER: Add new donor
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
    } catch (err) {
      setRegStatus('Registration Error: ' + err.message);
    }
  };

  const currentDonor = donors.find((d) => d.id === activeDonorId) || donors[0];

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '24px 20px' }}>
      {/* Top Header: Brand, District Dropdown & Persona Switcher */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '24px', color: 'var(--crimson)', fontWeight: 'bold', cursor: 'pointer' }} onClick={() => setActiveTab('Urgent Triage')}>
            🩸 RedLine
          </span>
          
          {/* 14 District Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 'bold' }}>📍 District:</span>
            <select
              className="neu-inset"
              value={district}
              onChange={(e) => setDistrict(e.target.value)}
              style={{ padding: '6px 12px', fontSize: '13px', fontWeight: 'bold', background: 'var(--bg-pearl)', cursor: 'pointer' }}
            >
              {KERALA_DISTRICTS.map((dist) => (
                <option key={dist} value={dist}>
                  {dist}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Persona Switcher */}
        <div className="neu-raised" style={{ padding: '6px 10px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--muted)', textTransform: 'uppercase', marginRight: '4px' }}>
            Simulate Persona:
          </span>
          <button
            type="button"
            onClick={() => setPersona('recipient')}
            className={`neu-pill ${persona === 'recipient' ? 'neu-pill-active' : ''}`}
            style={{ padding: '6px 12px', fontSize: '12px', fontWeight: 'bold' }}
          >
            🏥 Hospital Dispatcher
          </button>
          <button
            type="button"
            onClick={() => setPersona('donor')}
            className={`neu-pill ${persona === 'donor' ? 'neu-pill-active' : ''}`}
            style={{ padding: '6px 12px', fontSize: '12px', fontWeight: 'bold' }}
          >
            👤 Donor Portal
          </button>

          {persona === 'donor' && donors.length > 0 && (
            <select
              className="neu-inset"
              value={activeDonorId}
              onChange={(e) => setActiveDonorId(e.target.value)}
              style={{ padding: '4px 8px', fontSize: '12px', background: 'var(--bg-pearl)' }}
            >
              {donors.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.blood_group} - {d.is_eligible ? 'Eligible' : 'Cooldown'})
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Navigation Tabs */}
      <header style={{ display: 'flex', justifyContent: 'center', marginBottom: '32px' }}>
        <nav style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {['Live Matches', 'District Bank', 'Urgent Triage', 'Register Donor'].map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`neu-pill ${activeTab === tab ? 'neu-pill-active' : ''}`}
              style={{ padding: '8px 18px', fontSize: '13px', fontWeight: '500' }}
            >
              {tab}
            </button>
          ))}
        </nav>
      </header>

      {/* VIEW 1: URGENT TRIAGE */}
      {activeTab === 'Urgent Triage' && (
        <>
          {/* RECIPIENT / HOSPITAL DISPATCH VIEW */}
          {persona === 'recipient' && (
            <main style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              {/* Push Alert Toast */}
              {notifications.length > 0 && (
                <div
                  className="neu-raised"
                  style={{
                    width: '100%',
                    maxWidth: '640px',
                    marginBottom: '24px',
                    padding: '14px 20px',
                    borderLeft: '4px solid var(--sand)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '20px' }}>🔔</span>
                    <div>
                      <div style={{ fontWeight: 'bold', fontSize: '13px', color: 'var(--obsidian)' }}>
                        {notifications[0].title}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
                        {notifications[0].message}
                      </div>
                    </div>
                  </div>
                  <span className="neu-pill" style={{ padding: '4px 10px', fontSize: '11px', color: 'var(--sand)', fontWeight: 'bold' }}>
                    {notifications[0].time}
                  </span>
                </div>
              )}

              <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                <span style={{ fontSize: '11px', letterSpacing: '1.2px', color: 'var(--crimson)', fontWeight: 'bold' }}>
                  ● HIGH PRIORITY DISPATCH
                </span>
                <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: '36px', margin: '6px 0', color: 'var(--obsidian)' }}>
                  Request
                </h1>
                <p style={{ color: 'var(--muted)', fontSize: '14px', margin: 0 }}>
                  {district} District Operations • Instant Peer-to-Peer Triage
                </p>
              </div>

              {/* Form Card */}
              <form onSubmit={handleBroadcast} className="neu-raised" style={{ width: '100%', maxWidth: '640px', padding: '32px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '24px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div>
                      <label style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--muted)', display: 'block', marginBottom: '6px' }}>
                        PATIENT / RECIPIENT NAME
                      </label>
                      <input
                        className="neu-inset"
                        type="text"
                        value={patientName}
                        onChange={(e) => setPatientName(e.target.value)}
                        style={{ width: '100%' }}
                        required
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--muted)', display: 'block', marginBottom: '6px' }}>
                        TARGET HOSPITAL & WING
                      </label>
                      <input
                        className="neu-inset"
                        type="text"
                        value={hospital}
                        onChange={(e) => setHospital(e.target.value)}
                        style={{ width: '100%' }}
                        required
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--muted)', display: 'block', marginBottom: '6px' }}>
                        REQUESTED UNITS (PRBC / WHOLE)
                      </label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div className="neu-inset" style={{ flex: 1, textAlign: 'center', fontWeight: 'bold' }}>
                          🩸 {units} Units
                        </div>
                        <button type="button" className="neu-pill" style={{ width: '36px', height: '36px', fontSize: '16px' }} onClick={() => setUnits(Math.max(1, units - 1))}>-</button>
                        <button type="button" className="neu-pill" style={{ width: '36px', height: '36px', fontSize: '16px' }} onClick={() => setUnits(units + 1)}>+</button>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--muted)', display: 'block', marginBottom: '6px' }}>
                      BLOOD TYPE
                    </label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {BLOOD_GROUPS.map((group) => (
                        <button
                          key={group}
                          type="button"
                          onClick={() => setSelectedGroup(group)}
                          className={`neu-pill ${selectedGroup === group ? 'neu-pill-active' : ''}`}
                          style={{ padding: '9px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 'bold' }}
                        >
                          <span>{group}</span>
                          <span>{selectedGroup === group ? '●' : '›'}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div style={{ textAlign: 'center', marginTop: '28px' }}>
                  <button
                    type="submit"
                    disabled={loading}
                    className="neu-broadcast-btn"
                    style={{ padding: '12px 36px', fontSize: '14px' }}
                  >
                    {loading ? 'Broadcasting...' : `((•)) Broadcast in ${district}`}
                  </button>
                  {statusMessage && (
                    <p style={{ fontSize: '12px', color: 'var(--crimson)', fontWeight: 'bold', marginTop: '8px' }}>
                      {statusMessage}
                    </p>
                  )}
                  <p style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '8px' }}>
                    🔒 Encrypted SMS & App Alert to Verified Volunteers
                  </p>
                </div>
              </form>

              {/* Matched Donors Section */}
              <section style={{ width: '100%', maxWidth: '860px', marginTop: '40px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: '700', margin: 0 }}>
                    <span style={{ color: 'var(--crimson)' }}>●</span> Matched Donors in {district}{' '}
                    <span style={{ fontWeight: '400', color: 'var(--muted)' }}>(Masked Privacy Protocol)</span>
                  </h3>
                  <span style={{ fontSize: '12px', color: 'var(--sand)', fontWeight: 'bold' }}>
                    ● {donors.filter((d) => d.is_eligible).length} Eligible Donors Active Nearby
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px' }}>
                  {donors.length === 0 ? (
                    <div className="neu-raised" style={{ padding: '24px', textAlign: 'center', color: 'var(--muted)', gridColumn: '1 / -1' }}>
                      No registered donors found for {selectedGroup} in {district} district. (Use "Register Donor" to add one!)
                    </div>
                  ) : (
                    donors.map((donor) => {
                      const isAcceptedByThisDonor = matchedDonor?.id === donor.id;
                      const isOtherDonorAccepted = Boolean(matchedDonor && !isAcceptedByThisDonor);

                      return (
                        <div
                          key={donor.id}
                          className="neu-raised"
                          style={{
                            padding: '20px',
                            opacity: !donor.is_eligible || isOtherDonorAccepted ? 0.55 : 1,
                            border: isAcceptedByThisDonor ? '2px solid var(--crimson)' : 'none'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <div className="neu-inset" style={{ borderRadius: '50%', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '12px' }}>
                                {donor.name.split(' ').map((n) => n[0]).join('')}
                              </div>
                              <div>
                                <div style={{ fontWeight: 'bold', fontSize: '13px' }}>{donor.name}</div>
                                <div style={{ fontSize: '11px', color: 'var(--muted)' }}>{donor.district}</div>
                              </div>
                            </div>
                            <span className="neu-pill" style={{ padding: '4px 10px', fontWeight: 'bold', fontSize: '12px' }}>
                              {donor.blood_group}
                            </span>
                          </div>

                          <div style={{ fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '14px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ color: 'var(--muted)' }}>Phone:</span>
                              <strong style={{ color: isAcceptedByThisDonor ? 'var(--crimson)' : 'var(--obsidian)', fontFamily: 'monospace' }}>
                                {isAcceptedByThisDonor ? matchedDonor.phone : donor.masked_phone}
                              </strong>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ color: 'var(--muted)' }}>Interval Status:</span>
                              {donor.is_eligible ? (
                                <span style={{ color: '#2B7A4B', fontWeight: '600' }}>Eligible (Ready)</span>
                              ) : (
                                <span style={{ color: 'var(--sand)', fontWeight: '600' }}>
                                  {90 - donor.days_since_donation}d Cooldown Lock
                                </span>
                              )}
                            </div>
                          </div>

                          {isAcceptedByThisDonor ? (
                            <a
                              href={`tel:${matchedDonor.phone}`}
                              className="neu-pill"
                              style={{ display: 'block', textAlign: 'center', padding: '9px', fontSize: '12px', fontWeight: 'bold', color: 'var(--crimson)', textDecoration: 'none' }}
                            >
                              📞 Call Matched Donor
                            </a>
                          ) : isOtherDonorAccepted ? (
                            <div style={{ textAlign: 'center', fontSize: '11px', color: 'var(--muted)', padding: '6px 0' }}>
                              🔒 Fulfilled by another donor
                            </div>
                          ) : (
                            <div className="neu-inset" style={{ textAlign: 'center', fontSize: '11px', color: 'var(--muted)', padding: '8px' }}>
                              🔒 Contact Protected (Awaiting Donor Accept)
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </section>
            </main>
          )}

          {/* DONOR PORTAL VIEW */}
          {persona === 'donor' && (
            <main style={{ maxWidth: '640px', margin: '0 auto', width: '100%' }}>
              {!currentDonor ? (
                <div className="neu-raised" style={{ padding: '32px', textAlign: 'center', color: 'var(--muted)' }}>
                  No registered donors found in {district}. Switch district in the header or register a new donor profile.
                </div>
              ) : (
                <div className="neu-raised" style={{ padding: '32px', marginBottom: '24px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <div>
                      <span style={{ fontSize: '11px', letterSpacing: '1px', color: 'var(--sand)', fontWeight: 'bold' }}>
                        DONOR HEALTH PROFILE
                      </span>
                      <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: '28px', margin: '4px 0' }}>
                        {currentDonor.name}
                      </h2>
                      <span style={{ fontSize: '12px', color: 'var(--muted)' }}>Verified Volunteer • {currentDonor.district}</span>
                    </div>
                    <div className="neu-inset" style={{ padding: '12px 18px', textAlign: 'center' }}>
                      <div style={{ fontSize: '18px', fontWeight: 'bold', color: 'var(--crimson)' }}>{currentDonor.blood_group}</div>
                      <div style={{ fontSize: '10px', color: 'var(--muted)' }}>BLOOD TYPE</div>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                    <div className="neu-inset" style={{ padding: '14px' }}>
                      <div style={{ fontSize: '11px', color: 'var(--muted)' }}>DAYS SINCE LAST DONATION</div>
                      <div style={{ fontSize: '18px', fontWeight: 'bold', marginTop: '4px' }}>
                        {currentDonor.days_since_donation} Days
                      </div>
                    </div>

                    <div className="neu-inset" style={{ padding: '14px' }}>
                      <div style={{ fontSize: '11px', color: 'var(--muted)' }}>90-DAY INTERVAL RULE</div>
                      <div style={{ fontSize: '14px', fontWeight: 'bold', marginTop: '6px', color: currentDonor.is_eligible ? '#2B7A4B' : 'var(--crimson)' }}>
                        {currentDonor.is_eligible ? '✓ Fully Eligible' : `🔒 Locked (${90 - currentDonor.days_since_donation}d left)`}
                      </div>
                    </div>
                  </div>

                  {activeRequestId && !matchedDonor ? (
                    currentDonor.is_eligible && currentDonor.blood_group === selectedGroup ? (
                      <div className="neu-raised" style={{ padding: '20px', borderLeft: '4px solid var(--crimson)', background: '#FAF9F6' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                          <span style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--crimson)' }}>
                            🚨 URGENT TRIAGE DISPATCH IN {district.toUpperCase()}
                          </span>
                          <span className="neu-pill" style={{ padding: '3px 8px', fontSize: '10px', color: 'var(--crimson)', fontWeight: 'bold' }}>
                            ACTION NEEDED
                          </span>
                        </div>
                        <p style={{ fontSize: '13px', margin: '4px 0 16px 0', color: 'var(--obsidian)' }}>
                          <strong>{hospital}</strong> requires {units} unit(s) of <strong>{selectedGroup}</strong> for patient {patientName}.
                        </p>
                        <button
                          type="button"
                          onClick={() => handleAcceptDonation(currentDonor)}
                          className="neu-broadcast-btn"
                          style={{ width: '100%', padding: '12px', fontSize: '13px' }}
                        >
                          ✓ Accept & Share My Contact Details
                        </button>
                      </div>
                    ) : (
                      <div className="neu-inset" style={{ padding: '14px', textAlign: 'center', fontSize: '12px', color: 'var(--muted)' }}>
                        {currentDonor.is_eligible
                          ? `Incoming dispatch is for ${selectedGroup}. Stand by for dispatches in ${currentDonor.district} matching your blood group.`
                          : 'You are currently in your cooldown recovery interval (90-day protocol).'
                        }
                      </div>
                    )
                  ) : matchedDonor?.id === currentDonor.id ? (
                    <div className="neu-raised" style={{ padding: '20px', textAlign: 'center', border: '1.5px solid #2B7A4B' }}>
                      <div style={{ fontSize: '20px', marginBottom: '4px' }}>🤝</div>
                      <strong style={{ color: '#2B7A4B', fontSize: '14px' }}>You accepted this request!</strong>
                      <p style={{ fontSize: '12px', color: 'var(--muted)', margin: '6px 0 0 0' }}>
                        Your phone number ({matchedDonor.phone}) has been shared exclusively with {hospital}.
                      </p>
                    </div>
                  ) : matchedDonor ? (
                    <div className="neu-inset" style={{ padding: '14px', textAlign: 'center', fontSize: '12px', color: 'var(--muted)' }}>
                      Active triage ticket has been fulfilled by another volunteer donor.
                    </div>
                  ) : (
                    <div className="neu-inset" style={{ padding: '14px', textAlign: 'center', fontSize: '12px', color: 'var(--muted)' }}>
                      No active emergency dispatches pending in {district} at this moment.
                    </div>
                  )}
                </div>
              )}
            </main>
          )}
        </>
      )}

      {/* VIEW 2: LIVE MATCHES */}
      {activeTab === 'Live Matches' && (
        <section style={{ maxWidth: '720px', margin: '0 auto' }}>
          <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: '28px', marginBottom: '8px' }}>Active Match Logs</h2>
          <p style={{ color: 'var(--muted)', fontSize: '14px', marginBottom: '24px' }}>
            Real-time audit log of peer-to-peer donor responses in {district}.
          </p>
          
          <div className="neu-raised" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {!matchedDonor ? (
              <div style={{ textAlign: 'center', color: 'var(--muted)', padding: '20px 0' }}>
                No active donor handshake in {district} in this session. Dispatch a request in Urgent Triage and have a donor accept it.
              </div>
            ) : (
              <div className="neu-inset" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px' }}>
                <div>
                  <strong style={{ color: 'var(--crimson)' }}>Matched Donor: {matchedDonor.name}</strong>
                  <div style={{ fontSize: '12px', color: 'var(--muted)' }}>Triage Ticket #{activeRequestId?.slice(0, 8)} • Contact Shared Exclusively</div>
                </div>
                <a href={`tel:${matchedDonor.phone}`} className="neu-pill" style={{ padding: '8px 14px', fontSize: '13px', fontWeight: 'bold', color: 'var(--crimson)', textDecoration: 'none' }}>
                  📞 {matchedDonor.phone}
                </a>
              </div>
            )}
          </div>
        </section>
      )}

      {/* VIEW 3: DISTRICT BANK */}
      {activeTab === 'District Bank' && (
        <section style={{ maxWidth: '720px', margin: '0 auto' }}>
          <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: '28px', marginBottom: '8px' }}>{district} District Reserves</h2>
          <p style={{ color: 'var(--muted)', fontSize: '14px', marginBottom: '24px' }}>
            Aggregated volunteer donor pool status across taluks in {district}.
          </p>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '16px' }}>
            {BLOOD_GROUPS.map((bg) => {
              const count = donors.filter((d) => d.blood_group === bg).length;
              return (
                <div key={bg} className="neu-raised" style={{ padding: '20px', textAlign: 'center' }}>
                  <div style={{ fontSize: '22px', fontWeight: 'bold', color: 'var(--crimson)' }}>{bg}</div>
                  <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px' }}>Active Pool</div>
                  <div className="neu-inset" style={{ marginTop: '10px', fontSize: '13px', fontWeight: 'bold' }}>
                    {selectedGroup === bg ? `${count} Donors` : 'Standby'}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* VIEW 4: REGISTER DONOR */}
      {activeTab === 'Register Donor' && (
        <section style={{ maxWidth: '560px', margin: '0 auto' }}>
          <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: '28px', marginBottom: '8px', textAlign: 'center' }}>Join District Registry</h2>
          <p style={{ color: 'var(--muted)', fontSize: '14px', marginBottom: '28px', textAlign: 'center' }}>
            Register as a verified volunteer donor across Kerala. Your phone number remains encrypted and strictly private.
          </p>

          <form onSubmit={handleRegisterDonor} className="neu-raised" style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <div>
              <label style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--muted)', display: 'block', marginBottom: '6px' }}>
                FULL NAME
              </label>
              <input
                className="neu-inset"
                type="text"
                placeholder="e.g. Gautham S."
                value={regName}
                onChange={(e) => setRegName(e.target.value)}
                style={{ width: '100%' }}
                required
              />
            </div>

            <div>
              <label style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--muted)', display: 'block', marginBottom: '6px' }}>
                PHONE NUMBER (PROTECTED)
              </label>
              <input
                className="neu-inset"
                type="tel"
                placeholder="e.g. 9847123456"
                value={regPhone}
                onChange={(e) => setRegPhone(e.target.value)}
                style={{ width: '100%' }}
                required
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--muted)', display: 'block', marginBottom: '6px' }}>
                  DISTRICT
                </label>
                <select
                  className="neu-inset"
                  value={regDistrict}
                  onChange={(e) => setRegDistrict(e.target.value)}
                  style={{ width: '100%', background: 'var(--bg-pearl)' }}
                >
                  {KERALA_DISTRICTS.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--muted)', display: 'block', marginBottom: '6px' }}>
                  BLOOD GROUP
                </label>
                <select
                  className="neu-inset"
                  value={regGroup}
                  onChange={(e) => setRegGroup(e.target.value)}
                  style={{ width: '100%', background: 'var(--bg-pearl)' }}
                >
                  {BLOOD_GROUPS.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--muted)', display: 'block', marginBottom: '6px' }}>
                LAST DONATION (DAYS AGO)
              </label>
              <input
                className="neu-inset"
                type="number"
                value={regDaysAgo}
                onChange={(e) => setRegDaysAgo(Number(e.target.value))}
                style={{ width: '100%' }}
                min="0"
                required
              />
            </div>

            <button type="submit" className="neu-broadcast-btn" style={{ padding: '12px', marginTop: '10px' }}>
              Register Volunteer Donor
            </button>

            {regStatus && (
              <p style={{ textAlign: 'center', fontSize: '12px', color: 'var(--crimson)', fontWeight: 'bold', margin: 0 }}>
                {regStatus}
              </p>
            )}
          </form>
        </section>
      )}
    </div>
  );
}