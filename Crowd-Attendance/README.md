Technical Implementation Strategy:
Crowd-Verified Time Attendance System
1. Executive Summary
The digitalization of academic attendance has historically struggled to balance reliability,
privacy, and ease of use. Traditional methods ranging from manual roll calls to biometric
scanners or GPS-fencing suffer from scalability issues, hardware costs, or privacy concerns.
The proposed "Crowd-Verified Time Attendance System" represents a sophisticated evolution
in proximity-based verification, leveraging the ubiquity of student smartphones to create an
ephemeral, ad-hoc mesh network for validation. This architecture relies on a hybrid
verification model where the "truth" of attendance is derived not from a single data point, but
from the consensus of a localized peer group and a trusted anchor (the Lecturer).
Implementing such a system on the Android platform presents a unique set of challenges. The
modern Android ecosystem (Android 10 through Android 15) has evolved into a highly
restrictive environment designed to protect user privacy and battery life. These protections,
while beneficial for the user, actively interfere with the mechanisms required for continuous
peer discovery and hardware identification. The "cat-and-mouse" game of accessing stable
device identifiers, the aggressive throttling of background Wi-Fi scans, and the strict power
management policies of Doze mode necessitate a departure from standard application design
patterns.
This report outlines a deep technical implementation strategy for this enterprise-grade mobile
system. It rejects the usage of deprecated or restricted hardware identifiers in favor of a
cryptographic identity model rooted in Digital Rights Management (DRM) and
Hardware-Backed Key Attestation. It proposes a probabilistic, time-division multiplexed
approach to Bluetooth Low Energy (BLE) orchestration to mitigate packet collisions in
high-density classrooms. Furthermore, it details a high-throughput backend architecture
capable of ingesting burst traffic through asynchronous message queuing and validating
attendance via recursive graph traversal in PostgreSQL.
The following analysis is divided into five critical domains: Secure Identity, RF Engineering
(BLE), Cryptographic Protocols, Backend Scalability, and Anchor Logic. Each section provides
an exhaustive examination of the problem space, evaluates the proposed approaches against
the harsh reality of Android API limitations, and prescribes a definitive, future-proof
architectural solution.
2. Secure UUID Generation and Device Identity
Strategy
The foundation of any attendance system is the unforgeable binding between a digital user
account and a physical device. In a "Bring Your Own Device" (BYOD) university environment,
the system must ensure that a student cannot clone their identity onto a second device to
simulate attendance for an absent peer. The architectural challenge lies in generating a
unique, persistent Hardware ID without violating the stringent privacy sandboxing introduced
in Android 10 (API Level 29) and enforced with increasing rigor in Android 14.
2.1 The Evolution of Android Identity and Privacy Restrictions
Historically, Android developers relied on immutable hardware identifiers such as the
International Mobile Equipment Identity (IMEI), the Meid, or the hardware Serial Number to
track devices. These identifiers provided a permanent, non-resettable link to the physical
hardware. However, the misuse of these IDs for non-consensual cross-app tracking led
Google to fundamentally alter the permission landscape.
2.1.1 The Deprecation of Legacy Hardware IDs
Starting with Android 10, the permissions required to access the IMEI (READ_PHONE_STATE)
were bifurcated. A new privileged permission, READ_PRIVILEGED_PHONE_STATE, was
introduced for accessing non-resettable identifiers.
1 This permission is granted exclusively to
system applications signed with the device manufacturer's platform key or to device owner
applications in a managed enterprise environment.
2
For a standard application distributed via the Google Play Store, invoking Build.getSerial() or
TelephonyManager.getImei() results in a SecurityException on Android 10+ devices, or returns
a null/placeholder value like "unknown".
4 Consequently, the proposed formula in the project
context—SHA-256(AndroidID + Hardware_Serial + Salt)—is technically infeasible for the
majority of the target user base. The Hardware_Serial component effectively breaks the
implementation for any device running modern Android versions.
2.1.2 The Instability of ANDROID_ID
The Settings.Secure.ANDROID_ID remains accessible but has undergone significant changes
in behavior. Prior to Android 8.0 (Oreo), this ID was constant for a device. In modern Android,
this value is scoped to the signing key of the application and the user profile.
1 While this
prevents cross-app tracking, it introduces a critical vulnerability: the ANDROID_ID is reset if
the device is factory reset or if the signing key changes.
More critically, ANDROID_ID is purely software-defined. In the context of a university attended
by computer science students, the risk of "Identity Spoofing" via rooted devices is high.
Frameworks like Xposed or Magisk allow a user to hook into the Settings.Secure provider and
return a spoofed ANDROID_ID to specific applications.
6 This allows a single physical device to
cycle through multiple identities, facilitating mass truancy where one student "scans in" for
their entire dormitory.
2.2 The Recommended Solution: MediaDrm and Widevine ID
To achieve a persistent, hardware-backed identifier without requiring privileged permissions,
the architecture must leverage the Digital Rights Management (DRM) subsystem. The
Widevine DRM module, ubiquitous on Google-certified Android devices, exposes a unique
device ID used for provisioning cryptographic keys for media playback.
2.2.1 MediaDrm Implementation Mechanics
The MediaDrm API allows access to a byte array property named deviceUniqueId. Unlike the
ANDROID_ID, which is generated by the OS framework, the MediaDrm ID is derived from the
hardware root of trust in the device's Trusted Execution Environment (TEE) or Secure
Element.
7
The implementation strategy involves instantiating a MediaDrm session using the well-known
Widevine UUID (edef8ba9-79d6-4ace-a3c8-27dcd51d21ed). The system then queries the
property MediaDrm.PROPERTY_DEVICE_UNIQUE_ID. This operation returns a consistent byte
sequence that survives application re-installation and, on many implementations, persists
across factory resets, provided the DRM provisioning remains intact.
8
The recommended formula for the Unique Hardware ID is:
$$ \text{DeviceID} =
\text{Base64}(\text{SHA-256}(\text{MediaDrm.getPropertyByteArray}(\text{"deviceUniqueId"})
)) $$
This approach satisfies the requirement for uniqueness and persistence while adhering to
Android 10+ privacy guidelines, as it does not require runtime permissions.
8
2.3 Prevention of Identity Spoofing: Hardware-Backed Key Attestation
While MediaDrm provides a stable ID, it does not inherently prove that the software running on
the device is the legitimate attendance application or that the device hasn't been cloned or
rooted. To rigorously prevent "Identity Spoofing" (e.g., one student logging in on another's
phone), the system must implement Android KeyStore Attestation.
2.3.1 Cryptographic Binding of User to Device
The anti-spoofing mechanism relies on binding the student's account to a cryptographic key
pair that is generated and stored securely within the device's hardware, ensuring the key
cannot be exported or cloned to another device.
Implementation Workflow:
1. Key Generation: Upon initial login/registration, the application generates an Elliptic
Curve (EC) key pair (e.g., NIST P-256) inside the Android KeyStore. The application
explicitly requests that this key be stored in "StrongBox" (a separate secure hardware
chip) if available on the device.
9
2. Attestation Request: The application requests an Attestation Certificate Chain for
this key pair. This chain contains a leaf certificate signed by the device's hardware
KeyMaster/KeyMint. The certificate includes an extension containing the device's security
status (verified boot state) and identifiers.
9
3. Server-Side Verification: The application sends this certificate chain to the backend.
The backend validates the chain up to the Google Root Certificate. It verifies the
attestationSecurityLevel is TrustedEnvironment or StrongBox.
9 This mathematically
proves that the key exists in secure hardware and was not generated in a software
emulator.
4. Session Binding: The backend associates the Public Key from the certificate with the
Student ID.
2.3.2 Transaction Signing
For every subsequent attendance request (the BLE broadcast or the upload of peer logs), the
application must sign the payload using the Private Key stored in the KeyStore.
Since the Private Key is hardware-bound and non-exportable, it is physically impossible for a
student to extract this key and share it with a friend. To "spoof" the identity, the friend would
need physical possession of the student's unlocked device. This effectively neutralizes the risk
of account sharing or device cloning.10
2.4 Comparison of Identifier Strategies
The following table summarizes the evaluation of potential identifier strategies, highlighting
why the MediaDrm + Attestation approach is superior.
Strategy Android 10+
Viability
Persistence Spoofing
Resistance
Privacy
Compliance
User Formula
(SHA-256 w/
Serial)
Failed
(Serial/IMEI
restricted)
High (if
accessible)
High Illegal (Policy
Violation)
ANDROID_ID High Low (Resets on
Factory Reset)
Low (Root
Spoofing)
High
MAC Address Failed
(Randomized/
02:00...)
None Low Low
MediaDrm ID High High
(Hardware-bac
Medium High
ked)
MediaDrm +
Key
Attestation
High Very High Very High
(Non-exportab
le)
High
Recommendation: Adopt the MediaDrm ID for analytics and tracking, but enforce
Hardware-Backed Key Attestation for authentication and attendance signing. This creates a
multi-layered security posture that is robust against both casual and sophisticated spoofing
attempts.
3. BLE Optimization for High Performance
The core operational requirement is the simultaneous advertising and scanning of 50 to 100
devices within a confined physical space (a classroom). This scenario is classified as a
"High-Density" BLE environment. The physics of the 2.4 GHz ISM band, combined with the
scheduling limitations of Android's Bluetooth stack, make this a non-trivial engineering
challenge. Poor configuration will lead to "packet storms," where collisions render the mesh
invisible, or excessive battery drain, which alienates users.
3.1 RF Spectrum Dynamics and Collision Probability
BLE advertising occurs on three dedicated channels: 37, 38, and 39. When a device advertises,
it transmits a packet sequentially on these three frequencies. This process takes
approximately 1-2 milliseconds depending on the payload size. In a classroom with 100
devices, if every device advertises at the standard interval of 100ms, the theoretical load is
1,000 events per second.
Research into BLE mesh performance indicates that packet collision probability rises
exponentially with node density and frequency.
13 When two devices transmit on Channel 37 at
the exact same microsecond, the receiver (another student's phone) detects a corrupted CRC
and discards both packets. In high-density simulations, unoptimized intervals can result in a
packet loss rate exceeding 50%, meaning a student might sit in class for an hour and never be
"seen" by their peers if their transmission cycles synchronize destructively.
15
3.2 Configuration Strategy: Balancing Accuracy vs. Battery
To solve the collision problem without draining the battery, we must implement a
Probabilistic Backoff strategy and optimize the scan window.
3.2.1 Advertising Interval: The Case for Randomization
Using standard intervals (e.g., 100ms, 1000ms) creates "beat frequencies" where devices
drift into and out of phase with each other. If two devices lock into phase, they will collide
repeatedly for minutes.
We recommend a non-standard, randomized advertising interval.
● Base Interval: 211.25 ms.
○ Rationale: This specific value (and others like 318.75 ms) is recommended by Apple's
accessory design guidelines to minimize interference with Wi-Fi and other 2.4 GHz
protocols.
16
● Random Jitter: Apply a random delay of $\pm 10 \text{ ms}$ to each interval.
○ Rationale: This ensures that if Device A and Device B collide at $T_0$, their next
transmission times will diverge, breaking the collision lock.
15
Configuration:
● Advertising Mode: ADVERTISE_MODE_LOW_LATENCY (approx. 100ms) is too aggressive
for 100 devices. ADVERTISE_MODE_BALANCED (approx. 250ms) is ideal.
● Transmission Power: TX_POWER_MEDIUM. High power causes signal saturation and
reflections (multipath fading) in small rooms; medium power is sufficient for a 10-meter
classroom radius and saves battery.
13
3.2.2 Scan Window and Interval: The Duty Cycle
The scanner (Central role) must be active long enough to intercept the advertising packets.
● Scan Window: The duration the radio is listening.
● Scan Interval: The frequency at which the window repeats.
● Duty Cycle: $\frac{\text{Window}}{\text{Interval}}$.
A 100% duty cycle (Continuous Scanning) effectively monopolizes the radio. On many Android
chipsets, the Wi-Fi and Bluetooth radios share a single antenna and power amplifier.
Continuous BLE scanning forces the Wi-Fi radio to buffer or drop packets, leading to poor
internet connectivity—a critical failure for a university app where students might be using
Wi-Fi for coursework.
18
Recommended Configuration:
● Scan Window: 400 ms.
● Scan Interval: 1000 ms.
● Duty Cycle: 40%.
● Analysis: With 100 devices advertising every ~250 ms, a 400 ms window captures
approximately 1-2 packets from every device in range per second. Over a 5-minute
attendance window, this guarantees near 100% discovery probability while leaving 600
ms per second for Wi-Fi traffic and radio cooling.
18
3.3 Flutter Library Selection and Architecture
The Flutter ecosystem offers two primary libraries for BLE: flutter_blue_plus and
flutter_ble_peripheral. The project requirements create a conflict: flutter_blue_plus is robust
but supports only the Central role (Scanning).
19 flutter_ble_peripheral is necessary for the
Peripheral role (Advertising) to broadcast the student's ID.
21
Architectural Recommendation: Dual-Library Hybrid Implementation
The application must integrate both libraries. However, utilizing them simultaneously requires
careful orchestration to prevent resource contention at the OS level. Attempting to scan and
advertise at high duty cycles concurrently can lead to the "HAL (Hardware Abstraction Layer)
resource exhausted" error on lower-end Android devices.
Orchestration Logic:
The application should implement a Time-Division Multiplexing (TDM) state machine:
1. State: ADVERTISE (Duration: 10s): The app uses flutter_ble_peripheral to broadcast the
Secure UUID. Scanning is paused. This ensures maximum transmit stability.
2. State: SCAN (Duration: 5s): Advertising is paused. The app uses flutter_blue_plus to
scan for peers.
3. State: IDLE (Duration: 2s): Both radios are idle to allow for system housekeeping and
battery recovery.
4. Repeat.
This TDM approach dramatically reduces the collision domain (as only ~60% of students are
advertising at any given microsecond) and prevents thermal throttling of the radio chipset.
15
3.4 Handling Android Background Execution Limits
The most significant threat to the system's reliability is Android's power management: Doze
Mode and App Standby Buckets.
When a student locks their phone and puts it in their pocket, Android restricts the app's
access to the CPU and network. Without intervention, the attendance process will die within
minutes.22
3.4.1 Foreground Service Architecture
To guarantee execution during class, the app must run a Foreground Service.
● Mechanism: A Foreground Service displays a persistent notification (e.g., "Attendance
Active: Verifying Peers"). This signals to the Android OS that the user is aware of the
app's activity, effectively exempting it from the most aggressive Doze restrictions.
24
● Service Type: In Android 14, the service must declare
foregroundServiceType="connectedDevice|location". This explicitly justifies the need for
Bluetooth and location access.
23
3.4.2 Battery Optimization Exemptions
While Google discourages requesting exemptions from battery optimizations, for a
time-critical utility like attendance, it is necessary. The app should trigger the
ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS intent during onboarding. This moves
the app into the "Unrestricted" bucket, allowing it to hold partial WakeLocks and utilize the
alarm manager for the TDM cycles without jitter.
25
3.4.3 Hardware Offloading with ScanFilters
To further minimize battery impact, the scanning logic in flutter_blue_plus must utilize
ScanFilter. Instead of waking the application CPU for every BLE packet in the air (which
includes headphones, smartwatches, etc.), the app pushes the specific Service UUID of the
attendance system to the Bluetooth Controller. The hardware controller filters the packets and
only wakes the main CPU when a relevant peer packet is detected. This reduces CPU wakeups
by orders of magnitude.
26
4. Security & Anti-Spoofing Protocol
The broadcast nature of BLE makes it susceptible to Replay Attacks. A malicious student
could use a sniffer (like a standard Android phone running Wireshark or nRF Connect) to
record the advertising packets of a diligent student. The attacker could then re-broadcast
these packets in a future class, tricking the system into marking the absent student as
present. To prevent this, the advertising payload must be dynamic, ensuring that a packet
captured at $T_0$ is invalid at $T_1$.
4.1 Cryptographic Design: TOTP vs. HMAC-SHA256
Standard Time-based One-Time Password (TOTP) algorithms (RFC 6238) generate a 6-digit
numeric code. While compact, a 6-digit code has high collision probability in a large university
database and is ambiguous for identification.
Recommended Protocol: Truncated HMAC-SHA256
The architecture requires a custom protocol that embeds both identity and a validity window
into the constrained BLE payload.
The Setup:
1. Shared Secret ($K$): During the initial login, the server generates a cryptographically
secure random key (32 bytes) for the student. This key is transmitted to the app via TLS
and stored in the Android EncryptedSharedPreferences.
2. Time Epoch ($E$): We define a rolling time window of 30 seconds. $T = \lfloor
\text{CurrentTimeSeconds} / 30 \rfloor$.
3. Identity ($ID$): A static 4-byte hash of the student's database UUID (for quick lookup).
Packet Generation:
Every 30 seconds, the app calculates a signature:
$$ S = \text{HMAC-SHA256}(K, \ ID \ |
| \ T) $$
The app then truncates this hash to fit the BLE constraints.
4.2 Lightweight Payload Structure (< 30 Bytes)
The Legacy BLE Advertising packet has a maximum payload of 31 bytes.
● Flags: 3 bytes (Standard BLE requirement).
● Manufacturer Data Header: 2 bytes (Length + Type).
● Available Space: ~26 bytes.
We design a custom Manufacturer Data payload to utilize this space efficiently:
Field Size (Bytes) Description
Manufacturer ID 2 0xFFFF (Development) or
University Assigned ID.
Student Short ID 4 First 4 bytes of
SHA-256(MediaDrmID).
Allows the server to look up
the Shared Secret ($K$).
Time Counter 4 The 32-bit integer $T$.
Allows the server to handle
clock drift/synchronization.
Signature 12 The first 12 bytes of the
HMAC. This provides 96
bits of entropy, making
brute-force collision
impossible within the
30-second window.
Total 22 Bytes Fits comfortably within the
31-byte limit.
4.3 Validation Logic
When a peer scans this packet, they upload the raw bytes to the server. The peer does not
verify the signature (they do not have the secret key).
Server-Side Verification:
1. Parse the Student Short ID to retrieve the user's Shared Secret ($K$) and current status.
2. Parse the Time Counter. Verify it is within $\pm 1$ window of the server's time (handling
minor device clock drift).
3. Recompute the HMAC using $K$ and the received Time Counter.
4. Compare the computed signature with the received Signature.
5. Replay Defense: If the Time Counter is from 5 minutes ago, the verification fails
immediately. Even if an attacker replays a valid packet, the embedded timestamp renders
it obsolete.
27
5. Backend Scalability (Spring Boot & PostgreSQL)
The "Thundering Herd" problem defines the backend challenge. At the end of a class, 100
students might simultaneously upload logs containing 50-100 interactions each. This results
in a burst of ~10,000 distinct verification events hitting the server in a few seconds. A naive
synchronous architecture will lead to thread pool exhaustion and database lock contention.
5.1 Asynchronous Ingestion Architecture
The Spring Boot application must effectively decouple the receipt of data from the processing
of data.
Controller Layer (Non-Blocking):
The ingestion endpoint should be designed using Spring WebFlux or asynchronous execution
(@Async). Upon receiving a POST /upload-logs request, the controller performs a lightweight
schema validation and immediately pushes the payload to a message queue. It returns 202
Accepted to the mobile client instantly, releasing the connection.
Message Queue Strategy (RabbitMQ vs. Kafka):
● Recommendation: RabbitMQ.
○ Reasoning: While Kafka is superior for massive data streaming, the university context
(discrete bursts of distinct jobs) aligns better with RabbitMQ's precise routing and
acknowledgment capabilities. The scale (10k records/burst) is well within RabbitMQ's
capacity, and it offers lower latency for the "worker" pattern required here.
28
Consumer Service:
A pool of worker services subscribes to the queue. These workers handle the computationally
expensive tasks: cryptographic signature verification (HMAC recalculation) and database
persistence.
5.2 Optimizing Database Persistence
Inserting 10,000 records individually (INSERT INTO logs...) is a performance bottleneck due to
network round-trips and transaction overhead.
Optimization Strategy: JDBC Batching
The persistence layer should utilize JDBC Batch Updates. In Spring Data JPA, this is
configured via application.properties:
Properties
spring.jpa.properties.hibernate.jdbc.batch_size=50
spring.jpa.properties.hibernate.order_inserts=true
This configuration forces Hibernate to group 50 insert statements into a single network packet
sent to PostgreSQL. This reduces the I/O overhead by approximately 95% compared to single
inserts.
29
5.3 Efficient SQL Logic: The "Who Saw Whom" Graph
The core validation requirement is: "Attendance is valid only if a student is 'seen' by $N$ other
students."
This forms a Directed Graph where nodes are students and edges are verified sightings.
Schema Design:
● attendance_sessions (id, classroom_id, start_time, end_time)
● peer_sightings (uploader_id, seen_student_id, session_id, timestamp, is_verified)
Validation Logic:
We must filter out "Sybil Islands" (a group of 5 absent friends verifying each other remotely).
We anchor the trust graph to the Lecturer.
We use a Recursive Common Table Expression (CTE) in PostgreSQL to traverse the graph
starting from the Lecturer's node.
The Query:
SQL
WITH RECURSIVE TrustedCluster AS (
-- Base Case: The Lecturer (Anchor)
SELECT
seen_student_id as student_id,
1 as hop_count
FROM peer_sightings
WHERE uploader_id = :LECTURER_ID
AND session_id = :SESSION_ID
AND is_verified = TRUE
UNION
-- Recursive Step: Friends of Trusted Nodes
SELECT
ps.seen_student_id,
tc.hop_count + 1
FROM peer_sightings ps
INNER JOIN TrustedCluster tc ON ps.uploader_id = tc.student_id
WHERE ps.session_id = :SESSION_ID
AND ps.is_verified = TRUE
AND tc.hop_count < 3 -- Limit depth to prevent runaway recursion
)
-- Final Verification: Must be in the Trusted Cluster AND have N witnesses
SELECT
ps.seen_student_id,
COUNT(DISTINCT ps.uploader_id) as witness_count
FROM peer_sightings ps
WHERE ps.seen_student_id IN (SELECT student_id FROM TrustedCluster)
AND ps.session_id = :SESSION_ID
GROUP BY ps.seen_student_id
HAVING COUNT(DISTINCT ps.uploader_id) >= :N;
Analysis:
● The CTE (TrustedCluster) establishes a "Chain of Trust" originating from the teacher. Only
students who are topologically connected to the teacher (or the teacher's immediate
neighbors) are eligible.
31
● The HAVING clause enforces the $N$-peer density rule.
● This logic effectively neutralizes remote spoofing rings, as they will typically form a
disjoint graph component unconnected to the teacher.
6. The "Anchor" Logic (Teacher's Device)
The requirement for students to detect the Teacher's Wi-Fi BSSID is the most fragile
component of the system due to Android's aggressive Wi-Fi Scan Throttling.
Since Android 9, foreground apps are limited to 4 scans every 2 minutes. Background apps are
limited to one scan every 30 minutes.33 Relying on students to passively scan for the
teacher's hotspot will result in massive failure rates, as most scans will be blocked by the OS.
6.1 The Fallacy of Passive Scanning
If 100 students attempt to scan simultaneously, and they have recently scanned for other
networks, the OS will return cached results that might be minutes old. If the teacher just
turned on the hotspot, the students' phones will not see it until the throttle timer resets.
6.2 Recommended Strategy: Active Connection Intent
To bypass scan throttling, the application must shift from "Scanning" to "Connecting". The
Android OS grants high priority to actions that imply user intent to connect to a network.
6.2.1 LocalOnlyHotspot (Teacher Side)
The Teacher's device should initiate a LocalOnlyHotspot.
● API: WifiManager.startLocalOnlyHotspot().
● Behavior: This creates a temporary, SoftAP with a random SSID and Password (on older
Android) or a specific config (Android 13+ with NEARBY_WIFI_DEVICES permission).
34
● The Teacher's app generates a QR code containing the SSID and Password.
6.2.2 Network Specifier (Student Side)
Instead of scanning, the student app uses the WifiNetworkSpecifier API to request a
connection to the Teacher's specific SSID.
Java
WifiNetworkSpecifier.Builder()
.setSsid(teacherSsid)
.setWpa2Passphrase(teacherPassword)
.build();
● Bypass Mechanism: When the app requests a specific network, Android performs a
targeted scan for that SSID. This targeted scan is not subject to the same strict
throttling as a general scan because it serves a direct user connectivity request.
35
● Verification: The app does not need to fully establish an internet connection. The event
onAvailable() in the NetworkCallback confirms that the device successfully negotiated
with the Teacher's hardware AP. This serves as cryptographic proof of physical proximity
(as the handshake requires RF range).
6.3 Antenna Variability
Hardware antennas vary significantly in Transmit (Tx) power. A Pixel 7 might have a stronger
hotspot signal than a budget Samsung A-series.
Recommendation:
The system should rely on RSSI (Received Signal Strength Indicator) Normalization.
● The Teacher's app should broadcast its "Reference Tx Power" in the BLE Anchor packet.
● Student devices calculate distance using the Path Loss formula:
$$\text{Distance} = 10 ^ \frac{\text{TxPower} - \text{RSSI}}{10 \times n}$$
● The backend validates the BSSID detection but allows for a generous RSSI threshold
(e.g., -85 dBm) to account for weaker antennas, relying on the BLE mesh density to filter
out false positives at the fringe.
7. Conclusion
The "Crowd-Verified Time Attendance System" requires a high-fidelity implementation
strategy to survive the constraints of the modern Android ecosystem. By moving from legacy
Hardware IDs to MediaDrm-backed Key Attestation, the system ensures identity integrity
compliant with Android 14. The adoption of a Time-Division Multiplexed BLE strategy with
randomized intervals solves the collision physics of high-density classrooms. The Truncated
HMAC protocol secures the air gap against replay attacks, while the Recursive Graph Logic
in the backend secures the verification logic against collusion. Finally, utilizing Active
Network Requests over passive scanning bypasses the critical bottleneck of Wi-Fi throttling,
ensuring the Lecturer's Anchor node is reliably detected. This architecture provides a
scalable, secure, and robust foundation for university-wide deployment.
Works cited
1. From IMEI to MediaDrm: The Evolution and Breakdown of Android Device Identity
| by IdentX Labs | Oct, 2025 | Medium, accessed November 27, 2025,
https://medium.com/@identx_labs/from-imei-to-mediadrm-id-the-evolution-and
-breakdown-of-android-device-identity-9f14d49c6d98
2. Device identifiers - Android Open Source Project, accessed November 27, 2025,
https://source.android.com/docs/core/connect/device-identifiers
3. Privacy changes in Android 10 - Android Developers, accessed November 27,
2025, https://developer.android.com/about/versions/10/privacy/changes
4. Build.GetSerial Method (Android.OS) - Microsoft Learn, accessed November 27,
2025,
https://learn.microsoft.com/en-us/dotnet/api/android.os.build.getserial?view=netandroid-35.0
5. Build.GetSerial() returns unknown on API 29 - Stack Overflow, accessed
November 27, 2025,
https://stackoverflow.com/questions/59326190/build-getserial-returns-unknownon-api-29
6. How to prevent hackers from reverse engineering your android apps? - Reddit,
accessed November 27, 2025,
https://www.reddit.com/r/androiddev/comments/tq4051/how_to_prevent_hackers
_from_reverse_engineering/
7. How to get unique id in android Q? That must be same while uninstalling and
installing app, accessed November 27, 2025,
https://stackoverflow.com/questions/64509905/how-to-get-unique-id-in-androi
d-q-that-must-be-same-while-uninstalling-and-inst
8. Semedii/media_drm_id - GitHub, accessed November 27, 2025,
https://github.com/Semedii/media_drm_id
9. Key and ID attestation - Android Open Source Project, accessed November 27,
2025, https://source.android.com/docs/security/features/keystore/attestation
10. Android Keystore system | Security, accessed November 27, 2025,
https://developer.android.com/privacy-and-security/keystore
11. Verify hardware-backed key pairs with key attestation | Security - Android
Developers, accessed November 27, 2025,
https://developer.android.com/privacy-and-security/security-key-attestation
12. The Limitations of Google Play Integrity API (ex SafetyNet) - Approov, accessed
November 27, 2025,
https://approov.io/blog/limitations-of-google-play-integrity-api-ex-safetynet
13. Detailed Examination of a Packet Collision Model for Bluetooth Low Energy
Advertising Mode - CentAUR, accessed November 27, 2025,
https://centaur.reading.ac.uk/78467/9/08443321.pdf
14. Detailed Examination of a Packet Collision Model for Bluetooth Low Energy
Advertising Mode - IEEE Xplore, accessed November 27, 2025,
https://ieeexplore.ieee.org/iel7/6287639/8274985/08443321.pdf
15. Hundreds of BLE devices advertising simultaneously - Stack Overflow, accessed
November 27, 2025,
https://stackoverflow.com/questions/44412763/hundreds-of-ble-devices-advertis
ing-simultaneously
16. BLE Connectivity Architecture: The Ultimate Guide - Punch Through, accessed
November 27, 2025, https://punchthrough.com/ble-connectivity-architecture/
17. BLE Scan interval and window - Electrical Engineering Stack Exchange, accessed
November 27, 2025,
https://electronics.stackexchange.com/questions/82098/ble-scan-interval-and-wi
ndow
18. Ble Scan interval and window setup for best results? - Nordic DevZone, accessed
November 27, 2025,
https://devzone.nordicsemi.com/f/nordic-q-a/103760/ble-scan-interval-and-wind
ow-setup-for-best-results
19. Leveraging Flutter Blue Plus for Cross-Platform Development - DhiWise, accessed
November 27, 2025,
https://www.dhiwise.com/post/leveraging-flutter-blue-plus-for-cross-platform-d
evelopment
20. flutter_blue_plus | Flutter package - Pub.dev, accessed November 27, 2025,
https://pub.dev/packages/flutter_blue_plus
21. flutter_ble_peripheral | Flutter package - Pub.dev, accessed November 27, 2025,
https://pub.dev/packages/flutter_ble_peripheral
22. BLE Advertising Primer - Argenox, accessed November 27, 2025,
https://argenox.com/library/bluetooth-low-energy/ble-advertising-primer
23. Advanced BLE Development with Flutter Blue Plus | by Sparkleo - Medium,
accessed November 27, 2025,
https://medium.com/@sparkleo/advanced-ble-development-with-flutter-blue-pl
us-ec6dd17bf275
24. Work Around Android WiFi Throttling Restrictions? - Stack Overflow, accessed
November 27, 2025,
https://stackoverflow.com/questions/63606583/work-around-android-wifi-throttli
ng-restrictions
25. Excessive Wi-Fi Scanning in the Background | App quality - Android Developers,
accessed November 27, 2025,
https://developer.android.com/topic/performance/vitals/bg-wifi
26. Android BLE: The Ultimate Guide To Bluetooth Low Energy - Punch Through,
accessed November 27, 2025, https://punchthrough.com/android-ble-guide/
27. (PDF) ENHANCEMENT OF BLUETOOTH SECURITY AUTHENTICATION USING
HASH-BASED MESSAGE AUTHENTICATION CODE (HMAC) ALGORITHM -
ResearchGate, accessed November 27, 2025,
https://www.researchgate.net/publication/296443620_ENHANCEMENT_OF_BLUET
OOTH_SECURITY_AUTHENTICATION_USING_HASH-BASED_MESSAGE_AUTHENTI
CATION_CODE_HMAC_ALGORITHM
28. Scaling Spring Boot server for handling million REST API requests, addressing
thread rate limiters in scalable monolithic/microservices architecture. | GigaMe,
accessed November 27, 2025,
https://gigamein.com/Blogs/System-Design/Mjk4/Scaling-Spring-Boot-server-for
-handling-million-REST-API-requests-addressing-thread-rate-limiters-in-scalable
-monolithic-microservices-architecture29. Spring Boot: Boost JPA Bulk Insert Performance by 100x - DZone, accessed
November 27, 2025,
https://dzone.com/articles/spring-boot-boost-jpa-bulk-insert-performance-by-1
00x
30. Spring Boot: JPA Bulk Insert Performance by 100 times. - DEV Community,
accessed November 27, 2025,
https://dev.to/amrutprabhu/spring-boot-jpa-bulk-insert-performance-by-100-tim
es-fn4
31. PostgreSQL Recursive Query - Neon, accessed November 27, 2025,
https://neon.com/postgresql/postgresql-tutorial/postgresql-recursive-query
32. Safe Recursive Queries in PostgreSQL! A Thorough Guide to Using the CYCLE
Clause | Mamezou Developer Portal - 豆蔵デベロッパーサイト, accessed November
27, 2025,
https://developer.mamezou-tech.com/en/blogs/2025/01/17/cycle-postgres/
33. Wi-Fi scanning overview | Connectivity - Android Developers, accessed
November 27, 2025,
https://developer.android.com/develop/connectivity/wifi/wifi-scan
34. Use a local-only Wi-Fi hotspot | Connectivity - Android Developers, accessed
November 27, 2025,
https://developer.android.com/develop/connectivity/wifi/localonlyhotspot
35. Connect to Wi-Fi programmatically on Android 13 : r/androiddev - Reddit,
accessed November 27, 2025,
https://www.reddit.com/r/androiddev/comments/1f73vf0/connect_to_wifi_progra
mmatically_on_android_13/
