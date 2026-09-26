/**
 * Dindigul City Geo-fencing and Location Definitions for FG DRIVO
 */

const DINDIGUL_CENTER = {
  lat: 10.3673,
  lng: 77.9803,
  name: "Dindigul City Center",
  radiusKm: 25.0
};

// Popular Dindigul Landmarks with exact coordinates
const DINDIGUL_LANDMARKS = [
  {
    id: "bus_stand",
    name: "Dindigul Central Bus Stand",
    tamilName: "திண்டுக்கல் பேருந்து நிலையம்",
    address: "Palani Road / Main Bus Terminal, Dindigul, TN 624001",
    lat: 10.3625,
    lng: 77.9701,
    category: "Transit"
  },
  {
    id: "railway_junction",
    name: "Dindigul Railway Junction (DG)",
    tamilName: "திண்டுக்கல் ரயில் நிலையம்",
    address: "Railway Station Road, Nagal Nagar, Dindigul, TN 624003",
    lat: 10.3695,
    lng: 77.9730,
    category: "Transit"
  },
  {
    id: "rock_fort",
    name: "Dindigul Rock Fort (Malai Kottai)",
    tamilName: "திண்டுக்கல் மலைக்கோட்டை",
    address: "Rock Fort Hill, Dindigul, TN 624001",
    lat: 10.3610,
    lng: 77.9658,
    category: "Tourism"
  },
  {
    id: "collectorate",
    name: "District Collectorate & Court Complex",
    tamilName: "மாவட்ட ஆட்சியர் அலுவலகம்",
    address: "Velu Nachiyar Complex, Collectorate Post, Dindigul, TN 624004",
    lat: 10.3440,
    lng: 77.9850,
    category: "Government"
  },
  {
    id: "palani_road_roundana",
    name: "Palani Road Roundana",
    tamilName: "பழனி ரோடு ரவுண்டானா",
    address: "Palani Highway Junction, Dindigul, TN 624002",
    lat: 10.3752,
    lng: 77.9620,
    category: "Junction"
  },
  {
    id: "nagal_nagar",
    name: "Nagal Nagar Market & Spencer Compound",
    tamilName: "நாகல் நகர்",
    address: "Nagal Nagar Main Road, Dindigul, TN 624003",
    lat: 10.3688,
    lng: 77.9785,
    category: "Commercial"
  },
  {
    id: "begambur",
    name: "Begambur Big Mosque Area",
    tamilName: "பேகம்பூர் பெரிய பள்ளிவாசல்",
    address: "Begambur, Madurai Road, Dindigul, TN 624002",
    lat: 10.3580,
    lng: 77.9690,
    category: "Area"
  },
  {
    id: "gtn_college",
    name: "GTN Arts & Science College",
    tamilName: "ஜி.டி.என் கலைக்கல்லூரி",
    address: "Old Karur Road, GTN Nagar, Dindigul, TN 624005",
    lat: 10.3950,
    lng: 77.9890,
    category: "Education"
  },
  {
    id: "psna_college",
    name: "PSNA College of Engineering & Technology",
    tamilName: "பி.எஸ்.என்.ஏ பொறியியல் கல்லூரி",
    address: "Kothandaraman Nagar, Palani Highway, Dindigul, TN 624622",
    lat: 10.4280,
    lng: 77.9150,
    category: "Education"
  },
  {
    id: "gandhigram",
    name: "Gandhigram Rural Institute (Deemed Univ)",
    tamilName: "காந்திகிராம பல்கலைக்கழகம்",
    address: "Gandhigram, NH 44, Dindigul District, TN 624302",
    lat: 10.2830,
    lng: 77.9330,
    category: "Education"
  },
  {
    id: "batlagundu_road",
    name: "Batlagundu Road Bypass Checkpost",
    tamilName: "வத்தலகுண்டு ரோடு",
    address: "Batlagundu Bypass Road, Dindigul, TN 624002",
    lat: 10.3390,
    lng: 77.9420,
    category: "Junction"
  },
  {
    id: "round_road",
    name: "Round Road Pudur & AMC Road",
    tamilName: "ரவுண்ட் ரோடு புதூர்",
    address: "Round Road, Dindigul, TN 624005",
    lat: 10.3720,
    lng: 77.9920,
    category: "Residential"
  },
  {
    id: "chettinaickenpatti",
    name: "Chettinaickenpatti & Collectorate North",
    tamilName: "செட்டிநாயக்கன்பட்டி",
    address: "Chettinaickenpatti, Dindigul, TN 624004",
    lat: 10.3550,
    lng: 77.9980,
    category: "Residential"
  }
];

module.exports = {
  DINDIGUL_CENTER,
  DINDIGUL_LANDMARKS
};
