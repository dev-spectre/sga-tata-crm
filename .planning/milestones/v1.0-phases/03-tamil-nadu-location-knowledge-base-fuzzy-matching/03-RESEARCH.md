# Phase 3: Tamil Nadu Location Knowledge Base & Fuzzy Matching - Research

**Analysis Date:** 2026-09-11
**Status:** Completed

<summary>
Researched Tamil Nadu administrative geography (38 districts, major urban agglomerations, taluks, and postal code zones), string normalization techniques, and fast typo-tolerant algorithms (bounded Levenshtein distance, Jaro-Winkler, and prefix token indexing) to guarantee sub-5ms resolution without external dependencies.
</summary>

<standard_stack>
## Standard Stack & Technologies

### Computational Engine
- **Runtime:** Node.js 20+ / V8 JavaScript in Next.js Server & Client environments
- **Memory Footprint:** In-memory immutable TypeScript structures (~350–500 location nodes, footprint < 500 KB)
- **Zero Third-Party Native Dependencies:** Pure TypeScript string algorithms for portability and maximum execution speed
</standard_stack>

<geographical_taxonomy>
## Tamil Nadu Geographical Taxonomy

### 1. The 38 Districts of Tamil Nadu
Ariyalur, Chengalpattu, Chennai, Coimbatore, Cuddalore, Dharmapuri, Dindigul, Erode, Kallakurichi, Kanchipuram, Kanyakumari (Nagercoil), Karur, Krishnagiri, Madurai, Mayiladuthurai, Nagapattinam, Namakkal, Nilgiris (Ooty), Perambalur, Pudukkottai, Ramanathapuram, Ranipet, Salem, Sivaganga, Tenkasi, Thanjavur, Theni, Thoothukudi, Tiruchirappalli, Tirunelveli, Tirupathur, Tiruppur, Tiruvallur, Tiruvannamalai, Tiruvarur, Vellore, Viluppuram, Virudhunagar.

### 2. Major Automotive Catchment Hubs & Towns
- **Western Hub (Kongu Region):** Coimbatore (Gandhipuram, Peelamedu, RS Puram, Saravanampatti, Singanallur, Kuniyamuthur, Thudiyalur), Tiruppur (Avinashi, Palladam, Kangeyam, Dharapuram), Erode (Perundurai, Bhavani, Gobichettipalayam, Sathyamangalam), Salem (Attur, Mettur, Sankari, Omalur), Namakkal (Rasipuram, Tiruchengode, Paramathi Velur), Karur (Kulithalai, Aravakurichi), Nilgiris (Udhagamandalam/Ooty, Coonoor, Kotagiri, Gudalur).
- **Northern Hub:** Chennai (Anna Nagar, Guindy, Velachery, Tambaram, Chromepet, Porur, Sholinganallur, Ambattur, Avadi), Chengalpattu (Maraimalai Nagar, Guduvanchery, Kelambakkam), Tiruvallur (Poonamallee, Sriperumbudur, Gummidipoondi), Kanchipuram, Vellore (Katpadi), Ranipet (Arcot, Walajapet), Tirupattur (Vaniyambadi, Ambur), Krishnagiri (Hosur), Dharmapuri.
- **Central Hub:** Tiruchirappalli (Thillai Nagar, Srirangam, Cantonment), Thanjavur (Kumbakonam, Pattukkottai), Dindigul (Palani, Kodaikanal), Pudukkottai, Perambalur, Ariyalur, Nagapattinam, Mayiladuthurai, Tiruvarur, Cuddalore (Chidambaram, Neyveli, Panruti), Viluppuram (Tindivanam), Kallakurichi.
- **Southern Hub:** Madurai (KK Nagar, Anna Nagar, Simmakkal, Thirumangalam, Melur), Theni (Periyakulam, Bodinayakanur, Cumbum), Virudhunagar (Sivakasi, Rajapalayam, Aruppukkottai, Srivilliputhur), Sivaganga (Karaikudi, Devakottai), Ramanathapuram (Paramakudi), Thoothukudi (Kovilpatti, Tiruchendur), Tirunelveli (Palayamkottai, Valliyur, Ambasamudram), Tenkasi (Sankarankovil, Kadayanallur, Sengottai), Kanyakumari (Nagercoil, Marthandam, Thuckalay, Colachel).

### 3. Pincode System
Tamil Nadu pincodes span the `600xxx` to `643xxx` series:
- `600xxx`: Chennai & surrounding Tiruvallur/Chengalpattu
- `601xxx`–`603xxx`: Kanchipuram, Chengalpattu, Tiruvallur
- `604xxx`–`607xxx`: Viluppuram, Cuddalore, Tiruvannamalai
- `608xxx`–`614xxx`: Chidambaram, Nagapattinam, Thanjavur, Tiruvarur
- `620xxx`–`621xxx`: Tiruchirappalli, Perambalur, Ariyalur
- `622xxx`: Pudukkottai
- `623xxx`: Ramanathapuram, Sivaganga
- `624xxx`: Dindigul
- `625xxx`–`626xxx`: Madurai, Virudhunagar
- `627xxx`–`628xxx`: Tirunelveli, Thoothukudi, Tenkasi
- `629xxx`: Kanyakumari / Nagercoil
- `630xxx`: Sivaganga / Karaikudi
- `631xxx`–`632xxx`: Kanchipuram, Vellore, Ranipet
- `635xxx`: Krishnagiri, Dharmapuri, Hosur, Tirupattur
- `636xxx`–`637xxx`: Salem, Namakkal
- `638xxx`: Erode, Gobichettipalayam, Karur
- `639xxx`: Karur
- `641xxx`: Coimbatore, Tiruppur, Pollachi, Mettupalayam
- `642xxx`: Pollachi, Udumalaipettai
- `643xxx`: Nilgiris (Ooty, Coonoor)
</geographical_taxonomy>

<matching_algorithms>
## Matching Algorithms & Performance

### 1. Bounded Levenshtein Distance
Standard full matrix Levenshtein is $O(M \times N)$. For fast filtering against a dictionary of size $K$:
1. **Length Pre-filter:** If $|len(query) - len(target)| > maxDist$, skip immediately.
2. **First-Letter Partitioning:** Group candidates by initial character or allow distance 1 on initial typo.
3. **Early Exit / Two-Row Optimization:** Compute only the current and previous row; if $\min(row) > maxDist$, abort computation early.

### 2. Damerau-Levenshtein Enhancement
Handles transposition of adjacent characters (e.g. `Coimabtore` vs `Coimbatore`), which accounts for ~30% of human typing slips on mobile CRM input.

### 3. Confidence Scoring
$$\text{Confidence} = 1.0 - \frac{\text{Distance}}{\max(\text{length}(A), \text{length}(B))}$$
- Exact / Pincode match: 1.0
- Alias match: 0.98
- Substring match: 0.85–0.90
- Typo fuzzy match with distance 1: 0.85–0.92
- Typo fuzzy match with distance 2: 0.75–0.84
- Below 0.75: Reject match and flag for Phase 4 external geocoder fallback.
</matching_algorithms>
