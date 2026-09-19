import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

const BLOOD_GROUPS = ['O+', 'O-', 'A+', 'A-', 'B+'];

export default function App() {
  // Navigation View State
  const [activeTab, setActiveTab] = useState('Urgent Triage');

  // Form input states (Urgent Triage)
  const [patientName, setPatientName] = useState('Aditya Ramesh #ER-88421');
  const [hospital, setHospital] = useState('Aster Medcity, South Trauma Wing');
  const [selectedGroup, setSelectedGroup] = useState('O+');
  const [units, setUnits] = useState(2);
  const district = 'Ernakulam';

  // Application lifecycle & single-match state
  const [activeRequestId, setActiveRequestId] = useState(null);
  const [donors, setDonors] = useState([]);
  const [matchedDonor, setMatchedDonor] = useState(null); // Holds single accepted donor { id, name, phone }
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  // Register Donor State
  const [regName, setRegName] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regGroup, setRegGroup] = useState('O+');
  const [regDaysAgo, setRegDaysAgo] = useState(100);
  const [regStatus, setRegStatus] = useState('');

  // 1. MATCH: Query Postgres view for masked donors filtered by group & district
  const fetchDonors = async (bloodGroup) => {
    try {
      const { data, error } = await supabase
        .from('public_eligible_donors')
        .select('*')
        .eq('blood_group', bloodGroup)
        .eq('district', district);

      if (error) throw error;
      setDonors(data || []);
    } catch (err) {
      console.error('Error fetching donors:', err.message);
    }
  };

  useEffect(() => {
    fetchDonors(selectedGroup);
    // Reset matched state if user switches blood groups for a new search
    setMatchedDonor(null);
  }, [selectedGroup]);

  // 2. REQUEST & NOTIFY: Hospital broadcasts triage request; pings eligible volunteers
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

      // Notification event to matched eligible donors
      const eligibleCount = donors.filter((d) => d.is_eligible).length;
      const newNotification = {
        id: Date.now(),
        title: `🚨 Emergency Alert Dispatched (${selectedGroup})`,
        message: `High-priority ping sent to ${eligibleCount} eligible verified donors in ${district}.`,
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

  // 3. ACCEPT: First donor to accept claims the request; only their number is unmasked
  const handleAcceptDonation = async (donor) => {
    if (!activeRequestId) {
      alert('Please click "Broadcast Request" first to generate an active triage ticket.');
      return;
    }

    try {
      const { data: realPhone, error } = await supabase.rpc('accept_donation_request', {
        p_request_id: activeRequestId,
        p_donor_id: donor.id
      });

      if (error) throw error;

      // Lock match to ONLY this donor and reveal solely their contact info
      setMatchedDonor({
        id: donor.id,
        name: donor.name,
        phone: realPhone
      });

      setStatusMessage(`✓ Request Fulfilled! Matched with ${donor.name}.`);
    } catch (err) {
      alert('Acceptance failed: ' + err.message);
    }
  };

  // 4. REGISTER: Add new donor directly to Supabase
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
          district: district,
          last_donation_date: donationDate
        }
      ]);

      if (error) throw error;

      setRegStatus(`✓ Donor ${regName} registered successfully!`);
      setRegName('');
      setRegPhone('');
      fetchDonors(selectedGroup);
    } catch (err) {
      setRegStatus('Registration Error: ' + err.message);
    }
  };

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '32px 20px' }}>
      {/* Top Header & Interactive Navigation Bar */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '36px', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '24px', color: 'var(--crimson)', fontWeight: 'bold', cursor: 'pointer' }} onClick={() => setActiveTab('Urgent Triage')}>
            🩸 RedLine
          </span>
          <span className="neu-pill" style={{ padding: '6px 14px', fontSize: '13px', color: 'var(--muted)' }}>
            📍 {district} District
          </span>
        </div>

        <nav style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {['Live Matches', 'District Bank', 'Urgent Triage', 'Register Donor'].map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`neu-pill ${activeTab === tab ? 'neu-pill-active' : ''}`}
              style={{ padding: '8px 16px', fontSize: '13px', fontWeight: '500' }}
            >
              {tab}
            </button>
          ))}
        </nav>
      </header>

      {/* VIEW 1: URGENT TRIAGE */}
      {activeTab === 'Urgent Triage' && (
        <main style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          {/* Notification Banner */}
          {notifications.length > 0 && (
            <div
              className="neu-raised"
              style={{
                width: '100%',
                maxWidth: '640px',
                marginBottom: '28px',
                padding: '16px 20px',
                borderLeft: '4px solid var(--sand)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '22px' }}>🔔</span>
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
                {notifications[0].time} • Sent
              </span>
            </div>
          )}

          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <span style={{ fontSize: '11px', letterSpacing: '1.2px', color: 'var(--crimson)', fontWeight: 'bold' }}>
              ● HIGH PRIORITY DISPATCH
            </span>
            <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: '38px', margin: '8px 0', color: 'var(--obsidian)' }}>
              Request
            </h1>
            <p style={{ color: 'var(--muted)', fontSize: '14px', margin: 0 }}>
              Ernakulam District Operations • Instant Peer-to-Peer Triage
            </p>
          </div>

          {/* Form Card */}
          <form onSubmit={handleBroadcast} className="neu-raised" style={{ width: '100%', maxWidth: '640px', padding: '36px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '28px' }}>
              {/* Left Input Fields */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div className="neu-inset" style={{ flex: 1, textAlign: 'center', fontWeight: 'bold' }}>
                      🩸 {units} Units
                    </div>
                    <button type="button" className="neu-pill" style={{ width: '38px', height: '38px', fontSize: '16px' }} onClick={() => setUnits(Math.max(1, units - 1))}>-</button>
                    <button type="button" className="neu-pill" style={{ width: '38px', height: '38px', fontSize: '16px' }} onClick={() => setUnits(units + 1)}>+</button>
                  </div>
                </div>
              </div>

              {/* Blood Group Radio List */}
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
                      style={{ padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 'bold' }}
                    >
                      <span>{group}</span>
                      <span>{selectedGroup === group ? '●' : '›'}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ textAlign: 'center', marginTop: '32px' }}>
              <button
                type="submit"
                disabled={loading}
                className="neu-broadcast-btn"
                style={{ padding: '14px 42px', fontSize: '15px' }}
              >
                {loading ? 'Broadcasting...' : '((•)) Broadcast Request'}
              </button>
              {statusMessage && (
                <p style={{ fontSize: '12px', color: 'var(--crimson)', fontWeight: 'bold', marginTop: '10px' }}>
                  {statusMessage}
                </p>
              )}
              <p style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '8px' }}>
                🔒 Encrypted SMS & App Alert to Verified Volunteers
              </p>
            </div>
          </form>

          {/* Matched Donors Section */}
          <section style={{ width: '100%', maxWidth: '860px', marginTop: '48px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap', gap: '10px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: '700', margin: 0 }}>
                <span style={{ color: 'var(--crimson)' }}>●</span> Matched Donors{' '}
                <span style={{ fontWeight: '400', color: 'var(--muted)' }}>(Masked Privacy Protocol)</span>
              </h3>
              <span style={{ fontSize: '12px', color: 'var(--sand)', fontWeight: 'bold' }}>
                ● {donors.filter((d) => d.is_eligible).length} Eligible Donors Active Nearby
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '22px' }}>
              {donors.length === 0 ? (
                <div className="neu-raised" style={{ padding: '24px', textAlign: 'center', color: 'var(--muted)', gridColumn: '1 / -1' }}>
                  No registered donors found for {selectedGroup} in this district.
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
                        padding: '22px',
                        opacity: !donor.is_eligible || isOtherDonorAccepted ? 0.55 : 1,
                        border: isAcceptedByThisDonor ? '2px solid var(--crimson)' : 'none',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      {/* Header */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div
                            className="neu-inset"
                            style={{
                              borderRadius: '50%',
                              width: '38px',
                              height: '38px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 'bold',
                              fontSize: '13px'
                            }}
                          >
                            {donor.name.split(' ').map((n) => n[0]).join('')}
                          </div>
                          <div>
                            <div style={{ fontWeight: 'bold', fontSize: '14px' }}>{donor.name}</div>
                            <div style={{ fontSize: '11px', color: 'var(--muted)' }}>{donor.district}</div>
                          </div>
                        </div>
                        <span className="neu-pill" style={{ padding: '4px 10px', fontWeight: 'bold', fontSize: '12px' }}>
                          {donor.blood_group}
                        </span>
                      </div>

                      {/* Phone & Status Details */}
                      <div style={{ fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--muted)' }}>Phone:</span>
                          <strong style={{ color: isAcceptedByThisDonor ? 'var(--crimson)' : 'var(--obsidian)', fontFamily: 'monospace', fontSize: '13px' }}>
                            {isAcceptedByThisDonor ? matchedDonor.phone : donor.masked_phone}
                          </strong>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--muted)' }}>Status:</span>
                          {donor.is_eligible ? (
                            <span style={{ color: '#2B7A4B', fontWeight: '600' }}>Eligible (Ready)</span>
                          ) : (
                            <span style={{ color: 'var(--sand)', fontWeight: '600' }}>
                              {90 - donor.days_since_donation}d Cooldown Lock
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Notification alert indicator */}
                      {donor.is_eligible && activeRequestId && !matchedDonor && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--sand)', fontWeight: 'bold', marginBottom: '12px' }}>
                          <span>📲</span> Alert Pushed to Donor
                        </div>
                      )}

                      {/* Acceptance Action */}
                      {donor.is_eligible ? (
                        isAcceptedByThisDonor ? (
                          <a
                            href={`tel:${matchedDonor.phone}`}
                            className="neu-pill"
                            style={{
                              display: 'block',
                              textAlign: 'center',
                              padding: '10px',
                              fontSize: '12px',
                              fontWeight: 'bold',
                              color: 'var(--crimson)',
                              textDecoration: 'none'
                            }}
                          >
                            📞 Direct Line: {matchedDonor.phone}
                          </a>
                        ) : isOtherDonorAccepted ? (
                          <div style={{ textAlign: 'center', fontSize: '11px', color: 'var(--muted)', padding: '8px 0' }}>
                            🔒 Fulfilled by another donor
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleAcceptDonation(donor)}
                            className="neu-pill"
                            style={{
                              width: '100%',
                              padding: '10px',
                              fontSize: '12px',
                              fontWeight: 'bold'
                            }}
                          >
                            ⌛ Awaiting Acceptance
                          </button>
                        )
                      ) : (
                        <div style={{ textAlign: 'center', fontSize: '11px', color: 'var(--muted)', padding: '6px 0' }}>
                          🔒 Protected by 90-Day Rule
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

      {/* VIEW 2: LIVE MATCHES */}
      {activeTab === 'Live Matches' && (
        <section style={{ maxWidth: '720px', margin: '0 auto' }}>
          <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: '28px', marginBottom: '8px' }}>Active Match Logs</h2>
          <p style={{ color: 'var(--muted)', fontSize: '14px', marginBottom: '24px' }}>Real-time audit log of peer-to-peer donor responses in Ernakulam.</p>
          
          <div className="neu-raised" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {!matchedDonor ? (
              <div style={{ textAlign: 'center', color: 'var(--muted)', padding: '20px 0' }}>
                No active donor handshake in this session. Dispatch a request in Urgent Triage and have a donor accept it.
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
          <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: '28px', marginBottom: '8px' }}>Ernakulam District Reserves</h2>
          <p style={{ color: 'var(--muted)', fontSize: '14px', marginBottom: '24px' }}>Aggregated volunteer donor pool status across regional taluks.</p>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '16px' }}>
            {BLOOD_GROUPS.map((bg) => (
              <div key={bg} className="neu-raised" style={{ padding: '20px', textAlign: 'center' }}>
                <div style={{ fontSize: '22px', fontWeight: 'bold', color: 'var(--crimson)' }}>{bg}</div>
                <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px' }}>Active Pool</div>
                <div className="neu-inset" style={{ marginTop: '10px', fontSize: '13px', fontWeight: 'bold' }}>
                  {bg === 'O+' ? `${donors.length} Donors` : 'Standby'}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* VIEW 4: REGISTER DONOR */}
      {activeTab === 'Register Donor' && (
        <section style={{ maxWidth: '560px', margin: '0 auto' }}>
          <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: '28px', marginBottom: '8px', textAlign: 'center' }}>Join District Registry</h2>
          <p style={{ color: 'var(--muted)', fontSize: '14px', marginBottom: '28px', textAlign: 'center' }}>
            Register as a verified volunteer donor. Your phone number is kept encrypted and strictly private.
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