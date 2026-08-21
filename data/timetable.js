/**
 * GENERATED FILE - do not edit by hand.
 * Source: tools/raw/timetable.txt + tools/raw/courses.csv
 * Regenerate with: node tools/build-data.js
 *
 * This is the app's entire dataset. Swapping the timetable means regenerating
 * (or hand-replacing) this one file - no UI code needs to change.
 */
(function (global) {
  'use strict';

  var DATA = {
    /** Semester label shown in the UI. */
    semester: 'Autumn 2026',
    /** Teaching days, in week order. */
    days: ["Monday","Tuesday","Wednesday","Thursday","Friday"],
    /**
     * Class lengths in minutes. Lectures and tutorials run 50 minutes with a
     * 5-minute break before the next slot; labs run 160 minutes.
     */
    durations: {"Theory":50,"Tutorial":50,"Lab":160},
    /** Every course that appears at least once in the timetable. */
    courses: [
          {
                "code": "CH2102",
                "name": "Quantum Chemistry I",
                "dept": "CH"
          },
          {
                "code": "CH2103",
                "name": "Inorganic and Spectroscopy Laboratory",
                "dept": "CH"
          },
          {
                "code": "CH2104",
                "name": "Basic Inorganic Chemistry I",
                "dept": "CH"
          },
          {
                "code": "CH2105",
                "name": "Basic Organic Chemistry I",
                "dept": "CH"
          },
          {
                "code": "CH3101",
                "name": "Basic Transition Metal Chemistry",
                "dept": "CH"
          },
          {
                "code": "CH3102",
                "name": "Organic Chemistry I",
                "dept": "CH"
          },
          {
                "code": "CH3103",
                "name": "Quantum Chemistry II",
                "dept": "CH"
          },
          {
                "code": "CH3104",
                "name": "Organic Chemistry II",
                "dept": "CH"
          },
          {
                "code": "CH3105",
                "name": "Advanced Physical Chemistry Laboratory",
                "dept": "CH"
          },
          {
                "code": "CH3106",
                "name": "Chemical Kinetics",
                "dept": "CH"
          },
          {
                "code": "CH4102",
                "name": "Advanced Transition Metal Chemistry",
                "dept": "CH"
          },
          {
                "code": "CH4104",
                "name": "Advanced Organic Chemistry III",
                "dept": "CH"
          },
          {
                "code": "CH4105",
                "name": "Organic Functional Materials",
                "dept": "CH"
          },
          {
                "code": "CH4106",
                "name": "Fluorescence Spectroscopy: Principles and Applications",
                "dept": "CH"
          },
          {
                "code": "CH4107",
                "name": "Chemical Perspectives of Biological Pathways",
                "dept": "CH"
          },
          {
                "code": "CH4109",
                "name": "Polymer Chemistry",
                "dept": "CH"
          },
          {
                "code": "CH4111",
                "name": "Quantum Theory of Atoms and Molecules",
                "dept": "CH"
          },
          {
                "code": "CH4114",
                "name": "Molecular Simulation",
                "dept": "CH"
          },
          {
                "code": "CH4115",
                "name": "Chemistry for Alternative Energy Solutions",
                "dept": "CH"
          },
          {
                "code": "CH4116",
                "name": "Advanced Organic Chemistry I",
                "dept": "CH"
          },
          {
                "code": "CH4117",
                "name": "Advanced Organic Chemistry IV",
                "dept": "CH"
          },
          {
                "code": "CH4118",
                "name": "Chemistry Laboratory",
                "dept": "CH"
          },
          {
                "code": "CH4120",
                "name": "Research Methodology",
                "dept": "CH"
          },
          {
                "code": "CH4121",
                "name": "Statistical Thermodynamics",
                "dept": "CH"
          },
          {
                "code": "CH4122",
                "name": "Fundamentals of Sustainability Science",
                "dept": "CH"
          },
          {
                "code": "CH4123",
                "name": "Environmental Sustainability Laboratory",
                "dept": "CH"
          },
          {
                "code": "CH4124",
                "name": "Bioconjugation Laboratory",
                "dept": "CH"
          },
          {
                "code": "CH4125",
                "name": "Chemistry of Sustainable Materials",
                "dept": "CH"
          },
          {
                "code": "CH4126",
                "name": "Low Carbon Energy Systems",
                "dept": "CH"
          },
          {
                "code": "CH4127",
                "name": "Sustainability Project II",
                "dept": "CH"
          },
          {
                "code": "CH4128",
                "name": "Quantitative Assessment of Sustainability",
                "dept": "CH"
          },
          {
                "code": "CH5102",
                "name": "Glycochemistry, glycobiology and Medicinal Chemistry",
                "dept": "CH"
          },
          {
                "code": "CH5103",
                "name": "Supramolecular Chemistry and Applications",
                "dept": "CH"
          },
          {
                "code": "CH5104",
                "name": "Computational Chemistry",
                "dept": "CH"
          },
          {
                "code": "CS2101",
                "name": "Computer Organizations and Architecture",
                "dept": "CS"
          },
          {
                "code": "CS2102",
                "name": "Data Structures and Algorithms",
                "dept": "CS"
          },
          {
                "code": "CS2103",
                "name": "Data Structures and Algorithms Laboratory",
                "dept": "CS"
          },
          {
                "code": "CS3102",
                "name": "Programming in Python",
                "dept": "CS"
          },
          {
                "code": "CS4103",
                "name": "Artificial Intelligence for Data Science",
                "dept": "CS"
          },
          {
                "code": "ES2103",
                "name": "Minerals, rocks and deformation",
                "dept": "ES"
          },
          {
                "code": "ES2104",
                "name": "Geophysics and Hydrology",
                "dept": "ES"
          },
          {
                "code": "ES2105",
                "name": "Earth Science Laboratory I",
                "dept": "ES"
          },
          {
                "code": "ES3101",
                "name": "Mineralogy and Crystallography",
                "dept": "ES"
          },
          {
                "code": "ES3102",
                "name": "Mineralogy Laboratory",
                "dept": "ES"
          },
          {
                "code": "ES3103",
                "name": "Sedimentology",
                "dept": "ES"
          },
          {
                "code": "ES3104",
                "name": "Sedimentology Laboratory",
                "dept": "ES"
          },
          {
                "code": "ES3105",
                "name": "Seismology",
                "dept": "ES"
          },
          {
                "code": "ES3108",
                "name": "Principles of Atmospheric Science",
                "dept": "ES"
          },
          {
                "code": "ES4101",
                "name": "Structural Geology",
                "dept": "ES"
          },
          {
                "code": "ES4102",
                "name": "Structural Geology Laboratory",
                "dept": "ES"
          },
          {
                "code": "ES4103",
                "name": "Petrology",
                "dept": "ES"
          },
          {
                "code": "ES4104",
                "name": "Petrology Laboratory",
                "dept": "ES"
          },
          {
                "code": "ES4105",
                "name": "Geology of Natural Resources",
                "dept": "ES"
          },
          {
                "code": "ES4106",
                "name": "Environmental Science Fieldwork",
                "dept": "ES"
          },
          {
                "code": "ES4107",
                "name": "Inverse Theory",
                "dept": "ES"
          },
          {
                "code": "ES4108",
                "name": "Geotechnical Engineering",
                "dept": "ES"
          },
          {
                "code": "HU4102",
                "name": "Applied Micro-econometrics",
                "dept": "HU"
          },
          {
                "code": "HU4103",
                "name": "Basic Entrepreneurship",
                "dept": "HU"
          },
          {
                "code": "LS2101",
                "name": "Biochemistry",
                "dept": "LS"
          },
          {
                "code": "LS2102",
                "name": "Biology Laboratory II",
                "dept": "LS"
          },
          {
                "code": "LS2103",
                "name": "Biophysics",
                "dept": "LS"
          },
          {
                "code": "LS3101",
                "name": "Immunology",
                "dept": "LS"
          },
          {
                "code": "LS3102",
                "name": "Cell Biology",
                "dept": "LS"
          },
          {
                "code": "LS3103",
                "name": "Microbiology",
                "dept": "LS"
          },
          {
                "code": "LS3104",
                "name": "Cell Biology and Imaging Laboratory",
                "dept": "LS"
          },
          {
                "code": "LS3105",
                "name": "Gene Expression Laboratory",
                "dept": "LS"
          },
          {
                "code": "LS3106",
                "name": "IPhD Laboratory Rotation",
                "dept": "LS"
          },
          {
                "code": "LS4101",
                "name": "Plant Biology",
                "dept": "LS"
          },
          {
                "code": "LS4102",
                "name": "Physiology",
                "dept": "LS"
          },
          {
                "code": "LS4103",
                "name": "Developmental Biology",
                "dept": "LS"
          },
          {
                "code": "LS4104",
                "name": "Physiology and Developmental Biology Laboratory",
                "dept": "LS"
          },
          {
                "code": "LS4105",
                "name": "Neurobiology",
                "dept": "LS"
          },
          {
                "code": "LS4106",
                "name": "Cognition",
                "dept": "LS"
          },
          {
                "code": "LS4107",
                "name": "Epigenetics",
                "dept": "LS"
          },
          {
                "code": "LS4109",
                "name": "Protein Structure, Function and Engineering",
                "dept": "LS"
          },
          {
                "code": "LS4112",
                "name": "Advanced Behavioural Biology",
                "dept": "LS"
          },
          {
                "code": "LS4113",
                "name": "Chemical Biology",
                "dept": "LS"
          },
          {
                "code": "LS4114",
                "name": "Chemical Biology Laboratory I",
                "dept": "LS"
          },
          {
                "code": "LS4115",
                "name": "One Health",
                "dept": "LS"
          },
          {
                "code": "LS5101",
                "name": "Scientific Communication",
                "dept": "LS"
          },
          {
                "code": "LS5103",
                "name": "Research Methodology",
                "dept": "LS"
          },
          {
                "code": "MA2101",
                "name": "Analysis I",
                "dept": "MA"
          },
          {
                "code": "MA2102",
                "name": "Linear Algebra I",
                "dept": "MA"
          },
          {
                "code": "MA2104",
                "name": "Probability and Statistics I",
                "dept": "MA"
          },
          {
                "code": "MA3101",
                "name": "Multivariable Calculus",
                "dept": "MA"
          },
          {
                "code": "MA3103",
                "name": "Introduction to Graph Theory and Combinatorics",
                "dept": "MA"
          },
          {
                "code": "MA3104",
                "name": "Advanced Linear Algebra",
                "dept": "MA"
          },
          {
                "code": "MA3108",
                "name": "Stochastic Processes",
                "dept": "MA"
          },
          {
                "code": "MA3109",
                "name": "Topology and metric spaces",
                "dept": "MA"
          },
          {
                "code": "MA3110",
                "name": "Rings and Modules",
                "dept": "MA"
          },
          {
                "code": "MA4101",
                "name": "Field and Galois Theory",
                "dept": "MA"
          },
          {
                "code": "MA4102",
                "name": "Functional Analysis",
                "dept": "MA"
          },
          {
                "code": "MA4104",
                "name": "Algebraic Topology",
                "dept": "MA"
          },
          {
                "code": "MA4106",
                "name": "Statistics II",
                "dept": "MA"
          },
          {
                "code": "MA4107",
                "name": "Statistical Inference",
                "dept": "MA"
          },
          {
                "code": "MA4110",
                "name": "Geometry of Curves and Surfaces",
                "dept": "MA"
          },
          {
                "code": "MA4111",
                "name": "Numerical Analysis",
                "dept": "MA"
          },
          {
                "code": "MA4112",
                "name": "Multivariate Statistics",
                "dept": "MA"
          },
          {
                "code": "MA5102",
                "name": "Partial Differential Equations",
                "dept": "MA"
          },
          {
                "code": "MA5122",
                "name": "Commutative Algebra",
                "dept": "MA"
          },
          {
                "code": "MA5125",
                "name": "Complex Dynamics II",
                "dept": "MA"
          },
          {
                "code": "MA5126",
                "name": "Topics in Analysis",
                "dept": "MA"
          },
          {
                "code": "PH2101",
                "name": "Waves and optics",
                "dept": "PH"
          },
          {
                "code": "PH2103",
                "name": "Physics Laboratory II",
                "dept": "PH"
          },
          {
                "code": "PH2104",
                "name": "Thermal Physics",
                "dept": "PH"
          },
          {
                "code": "PH3101",
                "name": "Classical Mechanics",
                "dept": "PH"
          },
          {
                "code": "PH3102",
                "name": "Quantum Mechanics",
                "dept": "PH"
          },
          {
                "code": "PH3103",
                "name": "Mathematical Methods of Physics",
                "dept": "PH"
          },
          {
                "code": "PH3104",
                "name": "Electrical Circuits and Electronics",
                "dept": "PH"
          },
          {
                "code": "PH3105",
                "name": "Nuclear Physics Laboratory",
                "dept": "PH"
          },
          {
                "code": "PH4101",
                "name": "Condensed Matter Physics",
                "dept": "PH"
          },
          {
                "code": "PH4102",
                "name": "Introductory Astrophysics",
                "dept": "PH"
          },
          {
                "code": "PH4103",
                "name": "Condensed Matter Laboratory",
                "dept": "PH"
          },
          {
                "code": "PH4104",
                "name": "Nonlinear Dynamics",
                "dept": "PH"
          },
          {
                "code": "PH4106",
                "name": "Field Theory and Relativistic Quantum Mechanics",
                "dept": "PH"
          },
          {
                "code": "PH4107",
                "name": "Advanced Electricity, Magnetism, and Optics",
                "dept": "PH"
          },
          {
                "code": "PH4108",
                "name": "Biological Physics",
                "dept": "PH"
          },
          {
                "code": "PH4110",
                "name": "Soft Condensed Matter Physics",
                "dept": "PH"
          },
          {
                "code": "PH4113",
                "name": "General Theory of Relativity",
                "dept": "PH"
          },
          {
                "code": "PH5103",
                "name": "Condensed Matter Physics II",
                "dept": "PH"
          },
          {
                "code": "PH5113",
                "name": "Theoretical Physics I",
                "dept": "PH"
          },
          {
                "code": "PH5114",
                "name": "Nonequilibrium Quantum Dynamics",
                "dept": "PH"
          }
    ],
    /**
     * Every timetable event.
     *   day      - 'Monday' ... 'Friday'
     *   time     - 24h start time, 'HH:MM'
     *   minutes  - start time as minutes since midnight (sortable)
     *   duration - length in minutes (see durations above)
     *   course   - course code exactly as published
     *   type     - 'Theory' | 'Tutorial' | 'Lab'
     *   room     - room/location exactly as published
     */
    events: [
      {"id":"e0001","day":"Monday","time":"08:00","minutes":480,"duration":50,"course":"CH3102","type":"Tutorial","room":"G02"},
      {"id":"e0002","day":"Monday","time":"08:00","minutes":480,"duration":50,"course":"CH4106","type":"Tutorial","room":"101"},
      {"id":"e0003","day":"Monday","time":"08:00","minutes":480,"duration":50,"course":"CH4107","type":"Tutorial","room":"102"},
      {"id":"e0004","day":"Monday","time":"08:00","minutes":480,"duration":50,"course":"CH4128","type":"Tutorial","room":"101"},
      {"id":"e0005","day":"Monday","time":"08:00","minutes":480,"duration":50,"course":"ES4105","type":"Tutorial","room":"108"},
      {"id":"e0006","day":"Monday","time":"08:00","minutes":480,"duration":50,"course":"MA2102","type":"Tutorial","room":"Ramanujan Virtual Classroom"},
      {"id":"e0007","day":"Monday","time":"08:00","minutes":480,"duration":50,"course":"MA4101","type":"Tutorial","room":"G09"},
      {"id":"e0008","day":"Monday","time":"08:00","minutes":480,"duration":50,"course":"MA4106","type":"Tutorial","room":"211"},
      {"id":"e0009","day":"Monday","time":"08:00","minutes":480,"duration":50,"course":"PH3104","type":"Tutorial","room":"G08"},
      {"id":"e0010","day":"Monday","time":"08:00","minutes":480,"duration":50,"course":"PH4101","type":"Tutorial","room":"110"},
      {"id":"e0011","day":"Monday","time":"08:55","minutes":535,"duration":50,"course":"CH3102","type":"Theory","room":"G02"},
      {"id":"e0012","day":"Monday","time":"08:55","minutes":535,"duration":50,"course":"CH4106","type":"Theory","room":"101"},
      {"id":"e0013","day":"Monday","time":"08:55","minutes":535,"duration":50,"course":"CH4107","type":"Theory","room":"102"},
      {"id":"e0014","day":"Monday","time":"08:55","minutes":535,"duration":50,"course":"CH4128","type":"Theory","room":"101"},
      {"id":"e0015","day":"Monday","time":"08:55","minutes":535,"duration":50,"course":"ES2104","type":"Theory","room":"Ramanujan Virtual Classroom"},
      {"id":"e0016","day":"Monday","time":"08:55","minutes":535,"duration":50,"course":"ES4105","type":"Theory","room":"108"},
      {"id":"e0017","day":"Monday","time":"08:55","minutes":535,"duration":50,"course":"MA4101","type":"Theory","room":"G09"},
      {"id":"e0018","day":"Monday","time":"08:55","minutes":535,"duration":50,"course":"MA4106","type":"Theory","room":"211"},
      {"id":"e0019","day":"Monday","time":"08:55","minutes":535,"duration":50,"course":"PH3104","type":"Theory","room":"G08"},
      {"id":"e0020","day":"Monday","time":"08:55","minutes":535,"duration":50,"course":"PH4101","type":"Theory","room":"110"},
      {"id":"e0021","day":"Monday","time":"09:50","minutes":590,"duration":50,"course":"LS3101","type":"Theory","room":"102"},
      {"id":"e0022","day":"Monday","time":"09:50","minutes":590,"duration":50,"course":"LS4106","type":"Theory","room":"111"},
      {"id":"e0023","day":"Monday","time":"09:50","minutes":590,"duration":50,"course":"LS5101","type":"Theory","room":"108"},
      {"id":"e0024","day":"Monday","time":"09:50","minutes":590,"duration":50,"course":"MA3109","type":"Theory","room":"G09"},
      {"id":"e0025","day":"Monday","time":"09:50","minutes":590,"duration":50,"course":"MA4112","type":"Theory","room":"209"},
      {"id":"e0026","day":"Monday","time":"09:50","minutes":590,"duration":50,"course":"MA5126","type":"Theory","room":"211"},
      {"id":"e0027","day":"Monday","time":"09:50","minutes":590,"duration":50,"course":"PH2101","type":"Theory","room":"S N Bose Lecture Theatre"},
      {"id":"e0028","day":"Monday","time":"09:50","minutes":590,"duration":50,"course":"PH3102","type":"Theory","room":"G02"},
      {"id":"e0029","day":"Monday","time":"09:50","minutes":590,"duration":50,"course":"PH4106","type":"Theory","room":"103"},
      {"id":"e0030","day":"Monday","time":"10:45","minutes":645,"duration":50,"course":"CH4104","type":"Theory","room":"110"},
      {"id":"e0031","day":"Monday","time":"10:45","minutes":645,"duration":50,"course":"CH4127","type":"Theory","room":"108"},
      {"id":"e0032","day":"Monday","time":"10:45","minutes":645,"duration":50,"course":"ES3103","type":"Theory","room":"101"},
      {"id":"e0033","day":"Monday","time":"10:45","minutes":645,"duration":50,"course":"LS2103","type":"Theory","room":"S N Bose Lecture Theatre"},
      {"id":"e0034","day":"Monday","time":"10:45","minutes":645,"duration":50,"course":"LS3102","type":"Theory","room":"102"},
      {"id":"e0035","day":"Monday","time":"10:45","minutes":645,"duration":50,"course":"MA3104","type":"Theory","room":"G09"},
      {"id":"e0036","day":"Monday","time":"10:45","minutes":645,"duration":50,"course":"MA5102","type":"Theory","room":"211"},
      {"id":"e0037","day":"Monday","time":"10:45","minutes":645,"duration":50,"course":"PH4102","type":"Theory","room":"D N Wadia Lecture Theatre"},
      {"id":"e0038","day":"Monday","time":"10:45","minutes":645,"duration":50,"course":"PH5113","type":"Theory","room":"111"},
      {"id":"e0039","day":"Monday","time":"11:40","minutes":700,"duration":50,"course":"CH3103","type":"Theory","room":"G02"},
      {"id":"e0040","day":"Monday","time":"11:40","minutes":700,"duration":50,"course":"CH4120","type":"Theory","room":"111"},
      {"id":"e0041","day":"Monday","time":"11:40","minutes":700,"duration":50,"course":"ES3108","type":"Theory","room":"101"},
      {"id":"e0042","day":"Monday","time":"11:40","minutes":700,"duration":50,"course":"LS4109","type":"Theory","room":"G09"},
      {"id":"e0043","day":"Monday","time":"11:40","minutes":700,"duration":50,"course":"LS5103","type":"Theory","room":"108"},
      {"id":"e0044","day":"Monday","time":"11:40","minutes":700,"duration":50,"course":"MA5122","type":"Theory","room":"211"},
      {"id":"e0045","day":"Monday","time":"11:40","minutes":700,"duration":50,"course":"PH2104","type":"Theory","room":"S N Bose Lecture Theatre"},
      {"id":"e0046","day":"Monday","time":"11:40","minutes":700,"duration":50,"course":"PH4104","type":"Theory","room":"102"},
      {"id":"e0047","day":"Monday","time":"11:40","minutes":700,"duration":50,"course":"PH5103","type":"Theory","room":"112"},
      {"id":"e0048","day":"Monday","time":"13:30","minutes":810,"duration":160,"course":"CH2103","type":"Lab","room":"DCS 2nd Year Lab"},
      {"id":"e0049","day":"Monday","time":"13:30","minutes":810,"duration":50,"course":"CH4114","type":"Theory","room":"209"},
      {"id":"e0050","day":"Monday","time":"13:30","minutes":810,"duration":50,"course":"CH4117","type":"Theory","room":"108"},
      {"id":"e0051","day":"Monday","time":"13:30","minutes":810,"duration":50,"course":"CH5104","type":"Theory","room":"212"},
      {"id":"e0052","day":"Monday","time":"13:30","minutes":810,"duration":160,"course":"ES2105","type":"Lab","room":"DES 2nd Year Lab"},
      {"id":"e0053","day":"Monday","time":"13:30","minutes":810,"duration":50,"course":"ES3105","type":"Theory","room":"101"},
      {"id":"e0054","day":"Monday","time":"13:30","minutes":810,"duration":50,"course":"ES4103","type":"Theory","room":"112"},
      {"id":"e0055","day":"Monday","time":"13:30","minutes":810,"duration":160,"course":"LS2102","type":"Lab","room":"DBS 2nd Year Lab"},
      {"id":"e0056","day":"Monday","time":"13:30","minutes":810,"duration":50,"course":"LS3103","type":"Theory","room":"103"},
      {"id":"e0057","day":"Monday","time":"13:30","minutes":810,"duration":50,"course":"LS4115","type":"Theory","room":"111"},
      {"id":"e0058","day":"Monday","time":"13:30","minutes":810,"duration":50,"course":"MA3110","type":"Theory","room":"G09"},
      {"id":"e0059","day":"Monday","time":"13:30","minutes":810,"duration":50,"course":"MA4107","type":"Theory","room":"211"},
      {"id":"e0060","day":"Monday","time":"13:30","minutes":810,"duration":160,"course":"PH2103","type":"Lab","room":"DPS 2nd Year Lab"},
      {"id":"e0061","day":"Monday","time":"14:25","minutes":865,"duration":50,"course":"CH4111","type":"Theory","room":"G09"},
      {"id":"e0062","day":"Monday","time":"14:25","minutes":865,"duration":50,"course":"CH4125","type":"Theory","room":"108"},
      {"id":"e0063","day":"Monday","time":"14:25","minutes":865,"duration":50,"course":"CH5103","type":"Theory","room":"201"},
      {"id":"e0064","day":"Monday","time":"14:25","minutes":865,"duration":50,"course":"ES4107","type":"Theory","room":"111"},
      {"id":"e0065","day":"Monday","time":"14:25","minutes":865,"duration":50,"course":"LS4107","type":"Theory","room":"102"},
      {"id":"e0066","day":"Monday","time":"14:25","minutes":865,"duration":50,"course":"LS4112","type":"Theory","room":"112"},
      {"id":"e0067","day":"Monday","time":"14:25","minutes":865,"duration":50,"course":"MA4104","type":"Theory","room":"211"},
      {"id":"e0068","day":"Monday","time":"14:25","minutes":865,"duration":50,"course":"PH3103","type":"Theory","room":"G02"},
      {"id":"e0069","day":"Monday","time":"14:25","minutes":865,"duration":50,"course":"PH4108","type":"Theory","room":"101"},
      {"id":"e0070","day":"Monday","time":"15:20","minutes":920,"duration":50,"course":"CS2102","type":"Theory","room":"Ramanujan Virtual Classroom"},
      {"id":"e0071","day":"Monday","time":"15:20","minutes":920,"duration":50,"course":"CS3102","type":"Theory","room":"G09"},
      {"id":"e0072","day":"Monday","time":"15:20","minutes":920,"duration":50,"course":"PH4108","type":"Tutorial","room":"101"},
      {"id":"e0073","day":"Monday","time":"16:15","minutes":975,"duration":50,"course":"CH2102","type":"Theory","room":"S N Bose Lecture Theatre"},
      {"id":"e0074","day":"Monday","time":"16:15","minutes":975,"duration":50,"course":"CH3104","type":"Theory","room":"G02"},
      {"id":"e0075","day":"Monday","time":"16:15","minutes":975,"duration":50,"course":"CH4105","type":"Theory","room":"101"},
      {"id":"e0076","day":"Monday","time":"16:15","minutes":975,"duration":50,"course":"CH4109","type":"Theory","room":"112"},
      {"id":"e0077","day":"Monday","time":"16:15","minutes":975,"duration":50,"course":"CH4122","type":"Theory","room":"108"},
      {"id":"e0078","day":"Monday","time":"16:15","minutes":975,"duration":50,"course":"LS4102","type":"Theory","room":"102"},
      {"id":"e0079","day":"Monday","time":"16:15","minutes":975,"duration":50,"course":"LS4113","type":"Theory","room":"111"},
      {"id":"e0080","day":"Monday","time":"16:15","minutes":975,"duration":50,"course":"MA3108","type":"Theory","room":"G09"},
      {"id":"e0081","day":"Monday","time":"16:15","minutes":975,"duration":50,"course":"MA5125","type":"Theory","room":"211"},
      {"id":"e0082","day":"Monday","time":"16:15","minutes":975,"duration":50,"course":"PH4113","type":"Theory","room":"G08"},
      {"id":"e0083","day":"Monday","time":"17:10","minutes":1030,"duration":50,"course":"CH3104","type":"Tutorial","room":"G02"},
      {"id":"e0084","day":"Monday","time":"17:10","minutes":1030,"duration":50,"course":"CH4105","type":"Tutorial","room":"101"},
      {"id":"e0085","day":"Monday","time":"17:10","minutes":1030,"duration":50,"course":"CH4109","type":"Tutorial","room":"112"},
      {"id":"e0086","day":"Monday","time":"17:10","minutes":1030,"duration":50,"course":"CH4122","type":"Tutorial","room":"108"},
      {"id":"e0087","day":"Monday","time":"17:10","minutes":1030,"duration":50,"course":"LS4102","type":"Tutorial","room":"102"},
      {"id":"e0088","day":"Monday","time":"17:10","minutes":1030,"duration":50,"course":"LS4113","type":"Tutorial","room":"111"},
      {"id":"e0089","day":"Monday","time":"17:10","minutes":1030,"duration":50,"course":"MA3108","type":"Tutorial","room":"G09"},
      {"id":"e0090","day":"Monday","time":"17:10","minutes":1030,"duration":50,"course":"MA5125","type":"Tutorial","room":"211"},
      {"id":"e0091","day":"Monday","time":"17:10","minutes":1030,"duration":50,"course":"PH2101","type":"Tutorial","room":"S N Bose Lecture Theatre"},
      {"id":"e0092","day":"Monday","time":"17:10","minutes":1030,"duration":50,"course":"PH4113","type":"Tutorial","room":"G08"},
      {"id":"e0093","day":"Tuesday","time":"08:00","minutes":480,"duration":50,"course":"CH2105","type":"Tutorial","room":"S N Bose Lecture Theatre"},
      {"id":"e0094","day":"Tuesday","time":"08:00","minutes":480,"duration":50,"course":"CH4106","type":"Tutorial","room":"101"},
      {"id":"e0095","day":"Tuesday","time":"08:00","minutes":480,"duration":50,"course":"LS3101","type":"Tutorial","room":"102"},
      {"id":"e0096","day":"Tuesday","time":"08:00","minutes":480,"duration":50,"course":"LS4106","type":"Tutorial","room":"111"},
      {"id":"e0097","day":"Tuesday","time":"08:00","minutes":480,"duration":50,"course":"MA3109","type":"Tutorial","room":"G09"},
      {"id":"e0098","day":"Tuesday","time":"08:00","minutes":480,"duration":50,"course":"MA4112","type":"Tutorial","room":"209"},
      {"id":"e0099","day":"Tuesday","time":"08:00","minutes":480,"duration":50,"course":"PH3102","type":"Tutorial","room":"G02"},
      {"id":"e0100","day":"Tuesday","time":"08:00","minutes":480,"duration":50,"course":"PH4106","type":"Tutorial","room":"103"},
      {"id":"e0101","day":"Tuesday","time":"08:55","minutes":535,"duration":50,"course":"CH4106","type":"Theory","room":"101"},
      {"id":"e0102","day":"Tuesday","time":"08:55","minutes":535,"duration":50,"course":"ES2103","type":"Theory","room":"Ramanujan Virtual Classroom"},
      {"id":"e0103","day":"Tuesday","time":"08:55","minutes":535,"duration":50,"course":"LS3101","type":"Theory","room":"102"},
      {"id":"e0104","day":"Tuesday","time":"08:55","minutes":535,"duration":50,"course":"LS4106","type":"Theory","room":"111"},
      {"id":"e0105","day":"Tuesday","time":"08:55","minutes":535,"duration":50,"course":"LS5101","type":"Theory","room":"108"},
      {"id":"e0106","day":"Tuesday","time":"08:55","minutes":535,"duration":50,"course":"MA3109","type":"Theory","room":"G09"},
      {"id":"e0107","day":"Tuesday","time":"08:55","minutes":535,"duration":50,"course":"MA4112","type":"Theory","room":"209"},
      {"id":"e0108","day":"Tuesday","time":"08:55","minutes":535,"duration":50,"course":"MA5126","type":"Theory","room":"211"},
      {"id":"e0109","day":"Tuesday","time":"08:55","minutes":535,"duration":50,"course":"PH3102","type":"Theory","room":"G02"},
      {"id":"e0110","day":"Tuesday","time":"08:55","minutes":535,"duration":50,"course":"PH4106","type":"Theory","room":"103"},
      {"id":"e0111","day":"Tuesday","time":"09:50","minutes":590,"duration":50,"course":"CH4104","type":"Theory","room":"110"},
      {"id":"e0112","day":"Tuesday","time":"09:50","minutes":590,"duration":50,"course":"CH4127","type":"Theory","room":"108"},
      {"id":"e0113","day":"Tuesday","time":"09:50","minutes":590,"duration":50,"course":"ES3103","type":"Theory","room":"101"},
      {"id":"e0114","day":"Tuesday","time":"09:50","minutes":590,"duration":50,"course":"LS3102","type":"Theory","room":"102"},
      {"id":"e0115","day":"Tuesday","time":"09:50","minutes":590,"duration":50,"course":"MA2101","type":"Theory","room":"Ramanujan Virtual Classroom"},
      {"id":"e0116","day":"Tuesday","time":"09:50","minutes":590,"duration":50,"course":"MA3104","type":"Theory","room":"G09"},
      {"id":"e0117","day":"Tuesday","time":"09:50","minutes":590,"duration":50,"course":"MA5102","type":"Theory","room":"211"},
      {"id":"e0118","day":"Tuesday","time":"09:50","minutes":590,"duration":50,"course":"PH4102","type":"Theory","room":"D N Wadia Lecture Theatre"},
      {"id":"e0119","day":"Tuesday","time":"09:50","minutes":590,"duration":50,"course":"PH5113","type":"Theory","room":"111"},
      {"id":"e0120","day":"Tuesday","time":"10:45","minutes":645,"duration":50,"course":"CH4121","type":"Theory","room":"103"},
      {"id":"e0121","day":"Tuesday","time":"10:45","minutes":645,"duration":50,"course":"CH4126","type":"Theory","room":"201"},
      {"id":"e0122","day":"Tuesday","time":"10:45","minutes":645,"duration":50,"course":"ES3101","type":"Theory","room":"101"},
      {"id":"e0123","day":"Tuesday","time":"10:45","minutes":645,"duration":50,"course":"ES4108","type":"Theory","room":"108"},
      {"id":"e0124","day":"Tuesday","time":"10:45","minutes":645,"duration":50,"course":"LS2101","type":"Theory","room":"S N Bose Lecture Theatre"},
      {"id":"e0125","day":"Tuesday","time":"10:45","minutes":645,"duration":50,"course":"LS4101","type":"Theory","room":"102"},
      {"id":"e0126","day":"Tuesday","time":"10:45","minutes":645,"duration":50,"course":"MA4102","type":"Theory","room":"G09"},
      {"id":"e0127","day":"Tuesday","time":"10:45","minutes":645,"duration":50,"course":"PH3101","type":"Theory","room":"G02"},
      {"id":"e0128","day":"Tuesday","time":"10:45","minutes":645,"duration":50,"course":"PH4107","type":"Theory","room":"112"},
      {"id":"e0129","day":"Tuesday","time":"11:40","minutes":700,"duration":50,"course":"CH3102","type":"Theory","room":"G02"},
      {"id":"e0130","day":"Tuesday","time":"11:40","minutes":700,"duration":50,"course":"CH4107","type":"Theory","room":"102"},
      {"id":"e0131","day":"Tuesday","time":"11:40","minutes":700,"duration":50,"course":"CH4128","type":"Theory","room":"101"},
      {"id":"e0132","day":"Tuesday","time":"11:40","minutes":700,"duration":50,"course":"CS2103","type":"Theory","room":"201"},
      {"id":"e0133","day":"Tuesday","time":"11:40","minutes":700,"duration":50,"course":"ES2104","type":"Theory","room":"Ramanujan Virtual Classroom"},
      {"id":"e0134","day":"Tuesday","time":"11:40","minutes":700,"duration":50,"course":"ES4105","type":"Theory","room":"108"},
      {"id":"e0135","day":"Tuesday","time":"11:40","minutes":700,"duration":50,"course":"MA4101","type":"Theory","room":"G09"},
      {"id":"e0136","day":"Tuesday","time":"11:40","minutes":700,"duration":50,"course":"MA4106","type":"Theory","room":"211"},
      {"id":"e0137","day":"Tuesday","time":"11:40","minutes":700,"duration":50,"course":"PH3104","type":"Theory","room":"G08"},
      {"id":"e0138","day":"Tuesday","time":"11:40","minutes":700,"duration":50,"course":"PH4101","type":"Theory","room":"110"},
      {"id":"e0139","day":"Tuesday","time":"13:30","minutes":810,"duration":160,"course":"CH3105","type":"Lab","room":"DCS 3rd Year Lab 1"},
      {"id":"e0140","day":"Tuesday","time":"13:30","minutes":810,"duration":160,"course":"CH4118","type":"Lab","room":"DCS 4th Year Lab"},
      {"id":"e0141","day":"Tuesday","time":"13:30","minutes":810,"duration":160,"course":"CH4123","type":"Lab","room":"DCS 4th Year Lab 1"},
      {"id":"e0142","day":"Tuesday","time":"13:30","minutes":810,"duration":160,"course":"CH4124","type":"Lab","room":"DCS 4th Year Lab 2"},
      {"id":"e0143","day":"Tuesday","time":"13:30","minutes":810,"duration":50,"course":"CS2101","type":"Theory","room":"Ramanujan Virtual Classroom"},
      {"id":"e0144","day":"Tuesday","time":"13:30","minutes":810,"duration":160,"course":"ES3102","type":"Lab","room":"DES 3rd Year Lab"},
      {"id":"e0145","day":"Tuesday","time":"13:30","minutes":810,"duration":160,"course":"ES3104","type":"Lab","room":"DES 3rd Year Lab 1"},
      {"id":"e0146","day":"Tuesday","time":"13:30","minutes":810,"duration":160,"course":"ES4102","type":"Lab","room":"DES 4th Year Lab"},
      {"id":"e0147","day":"Tuesday","time":"13:30","minutes":810,"duration":160,"course":"ES4104","type":"Lab","room":"DES 4th Year Lab 1"},
      {"id":"e0148","day":"Tuesday","time":"13:30","minutes":810,"duration":160,"course":"ES4106","type":"Lab","room":"DES 4th Year Lab 2"},
      {"id":"e0149","day":"Tuesday","time":"13:30","minutes":810,"duration":160,"course":"LS3104","type":"Lab","room":"DBS 3rd Year Lab"},
      {"id":"e0150","day":"Tuesday","time":"13:30","minutes":810,"duration":160,"course":"LS3105","type":"Lab","room":"DBS 3rd Year Lab 1"},
      {"id":"e0151","day":"Tuesday","time":"13:30","minutes":810,"duration":160,"course":"LS3106","type":"Lab","room":"DBS 3rd Year Lab 2"},
      {"id":"e0152","day":"Tuesday","time":"13:30","minutes":810,"duration":160,"course":"LS4104","type":"Lab","room":"DBS 4th Year Lab"},
      {"id":"e0153","day":"Tuesday","time":"13:30","minutes":810,"duration":160,"course":"LS4114","type":"Lab","room":"DBS 4th Year Lab 1"},
      {"id":"e0154","day":"Tuesday","time":"13:30","minutes":810,"duration":160,"course":"MA4111","type":"Lab","room":"DMS 4th Year Lab"},
      {"id":"e0155","day":"Tuesday","time":"13:30","minutes":810,"duration":160,"course":"PH3105","type":"Lab","room":"DPS 3rd Year Lab"},
      {"id":"e0156","day":"Tuesday","time":"13:30","minutes":810,"duration":160,"course":"PH4103","type":"Lab","room":"DPS 4th Year Lab"},
      {"id":"e0157","day":"Tuesday","time":"14:25","minutes":865,"duration":50,"course":"CH2104","type":"Theory","room":"S N Bose Lecture Theatre"},
      {"id":"e0158","day":"Tuesday","time":"16:15","minutes":975,"duration":50,"course":"CH3106","type":"Theory","room":"102"},
      {"id":"e0159","day":"Tuesday","time":"16:15","minutes":975,"duration":50,"course":"CH4115","type":"Theory","room":"G09"},
      {"id":"e0160","day":"Tuesday","time":"16:15","minutes":975,"duration":50,"course":"CH4116","type":"Theory","room":"101"},
      {"id":"e0161","day":"Tuesday","time":"16:15","minutes":975,"duration":50,"course":"CS4103","type":"Theory","room":"G02"},
      {"id":"e0162","day":"Tuesday","time":"16:15","minutes":975,"duration":50,"course":"HU4102","type":"Theory","room":"111"},
      {"id":"e0163","day":"Tuesday","time":"16:15","minutes":975,"duration":50,"course":"HU4103","type":"Theory","room":"108"},
      {"id":"e0164","day":"Tuesday","time":"16:15","minutes":975,"duration":50,"course":"LS4105","type":"Theory","room":"112"},
      {"id":"e0165","day":"Tuesday","time":"16:15","minutes":975,"duration":50,"course":"MA2104","type":"Tutorial","room":"D N Wadia Lecture Theatre"},
      {"id":"e0166","day":"Tuesday","time":"16:15","minutes":975,"duration":50,"course":"MA3103","type":"Theory","room":"211"},
      {"id":"e0167","day":"Tuesday","time":"16:15","minutes":975,"duration":50,"course":"PH5114","type":"Theory","room":"201"},
      {"id":"e0168","day":"Tuesday","time":"17:10","minutes":1030,"duration":50,"course":"CH3106","type":"Tutorial","room":"102"},
      {"id":"e0169","day":"Tuesday","time":"17:10","minutes":1030,"duration":50,"course":"CH4115","type":"Tutorial","room":"G09"},
      {"id":"e0170","day":"Tuesday","time":"17:10","minutes":1030,"duration":50,"course":"CH4116","type":"Tutorial","room":"101"},
      {"id":"e0171","day":"Tuesday","time":"17:10","minutes":1030,"duration":50,"course":"CS4103","type":"Tutorial","room":"G02"},
      {"id":"e0172","day":"Tuesday","time":"17:10","minutes":1030,"duration":50,"course":"ES2103","type":"Tutorial","room":"D N Wadia Lecture Theatre"},
      {"id":"e0173","day":"Tuesday","time":"17:10","minutes":1030,"duration":50,"course":"HU4102","type":"Tutorial","room":"111"},
      {"id":"e0174","day":"Tuesday","time":"17:10","minutes":1030,"duration":50,"course":"HU4103","type":"Tutorial","room":"108"},
      {"id":"e0175","day":"Tuesday","time":"17:10","minutes":1030,"duration":50,"course":"LS4105","type":"Tutorial","room":"112"},
      {"id":"e0176","day":"Tuesday","time":"17:10","minutes":1030,"duration":50,"course":"MA3103","type":"Tutorial","room":"211"},
      {"id":"e0177","day":"Tuesday","time":"17:10","minutes":1030,"duration":50,"course":"PH5114","type":"Tutorial","room":"201"},
      {"id":"e0178","day":"Wednesday","time":"08:00","minutes":480,"duration":50,"course":"CH4114","type":"Tutorial","room":"209"},
      {"id":"e0179","day":"Wednesday","time":"08:00","minutes":480,"duration":50,"course":"CH4117","type":"Tutorial","room":"108"},
      {"id":"e0180","day":"Wednesday","time":"08:00","minutes":480,"duration":50,"course":"CH5104","type":"Tutorial","room":"212"},
      {"id":"e0181","day":"Wednesday","time":"08:00","minutes":480,"duration":50,"course":"ES3105","type":"Tutorial","room":"101"},
      {"id":"e0182","day":"Wednesday","time":"08:00","minutes":480,"duration":50,"course":"ES4103","type":"Tutorial","room":"112"},
      {"id":"e0183","day":"Wednesday","time":"08:00","minutes":480,"duration":50,"course":"LS3103","type":"Tutorial","room":"103"},
      {"id":"e0184","day":"Wednesday","time":"08:00","minutes":480,"duration":50,"course":"LS4115","type":"Tutorial","room":"111"},
      {"id":"e0185","day":"Wednesday","time":"08:00","minutes":480,"duration":50,"course":"MA3110","type":"Tutorial","room":"G09"},
      {"id":"e0186","day":"Wednesday","time":"08:00","minutes":480,"duration":50,"course":"MA4107","type":"Tutorial","room":"211"},
      {"id":"e0187","day":"Wednesday","time":"08:00","minutes":480,"duration":50,"course":"PH2104","type":"Tutorial","room":"S N Bose Lecture Theatre"},
      {"id":"e0188","day":"Wednesday","time":"08:55","minutes":535,"duration":50,"course":"CH4114","type":"Theory","room":"209"},
      {"id":"e0189","day":"Wednesday","time":"08:55","minutes":535,"duration":50,"course":"CH4117","type":"Theory","room":"108"},
      {"id":"e0190","day":"Wednesday","time":"08:55","minutes":535,"duration":50,"course":"CH5104","type":"Theory","room":"212"},
      {"id":"e0191","day":"Wednesday","time":"08:55","minutes":535,"duration":50,"course":"ES3105","type":"Theory","room":"101"},
      {"id":"e0192","day":"Wednesday","time":"08:55","minutes":535,"duration":50,"course":"ES4103","type":"Theory","room":"112"},
      {"id":"e0193","day":"Wednesday","time":"08:55","minutes":535,"duration":50,"course":"LS3103","type":"Theory","room":"103"},
      {"id":"e0194","day":"Wednesday","time":"08:55","minutes":535,"duration":50,"course":"LS4115","type":"Theory","room":"111"},
      {"id":"e0195","day":"Wednesday","time":"08:55","minutes":535,"duration":50,"course":"MA2104","type":"Theory","room":"Ramanujan Virtual Classroom"},
      {"id":"e0196","day":"Wednesday","time":"08:55","minutes":535,"duration":50,"course":"MA3110","type":"Theory","room":"G09"},
      {"id":"e0197","day":"Wednesday","time":"08:55","minutes":535,"duration":50,"course":"MA4107","type":"Theory","room":"211"},
      {"id":"e0198","day":"Wednesday","time":"09:50","minutes":590,"duration":50,"course":"CH4111","type":"Theory","room":"G09"},
      {"id":"e0199","day":"Wednesday","time":"09:50","minutes":590,"duration":50,"course":"CH4125","type":"Theory","room":"108"},
      {"id":"e0200","day":"Wednesday","time":"09:50","minutes":590,"duration":50,"course":"CH5103","type":"Theory","room":"201"},
      {"id":"e0201","day":"Wednesday","time":"09:50","minutes":590,"duration":50,"course":"CS2101","type":"Theory","room":"Ramanujan Virtual Classroom"},
      {"id":"e0202","day":"Wednesday","time":"09:50","minutes":590,"duration":50,"course":"ES4107","type":"Theory","room":"111"},
      {"id":"e0203","day":"Wednesday","time":"09:50","minutes":590,"duration":50,"course":"LS4107","type":"Theory","room":"102"},
      {"id":"e0204","day":"Wednesday","time":"09:50","minutes":590,"duration":50,"course":"LS4112","type":"Theory","room":"112"},
      {"id":"e0205","day":"Wednesday","time":"09:50","minutes":590,"duration":50,"course":"MA4104","type":"Theory","room":"211"},
      {"id":"e0206","day":"Wednesday","time":"09:50","minutes":590,"duration":50,"course":"PH3103","type":"Theory","room":"G02"},
      {"id":"e0207","day":"Wednesday","time":"09:50","minutes":590,"duration":50,"course":"PH4108","type":"Theory","room":"101"},
      {"id":"e0208","day":"Wednesday","time":"10:45","minutes":645,"duration":50,"course":"CH3101","type":"Theory","room":"G08"},
      {"id":"e0209","day":"Wednesday","time":"10:45","minutes":645,"duration":50,"course":"CH4102","type":"Theory","room":"102"},
      {"id":"e0210","day":"Wednesday","time":"10:45","minutes":645,"duration":50,"course":"CH5102","type":"Theory","room":"201"},
      {"id":"e0211","day":"Wednesday","time":"10:45","minutes":645,"duration":50,"course":"ES4101","type":"Theory","room":"101"},
      {"id":"e0212","day":"Wednesday","time":"10:45","minutes":645,"duration":50,"course":"LS2103","type":"Theory","room":"S N Bose Lecture Theatre"},
      {"id":"e0213","day":"Wednesday","time":"10:45","minutes":645,"duration":50,"course":"LS4103","type":"Theory","room":"103"},
      {"id":"e0214","day":"Wednesday","time":"10:45","minutes":645,"duration":50,"course":"MA3101","type":"Theory","room":"G09"},
      {"id":"e0215","day":"Wednesday","time":"10:45","minutes":645,"duration":50,"course":"MA4110","type":"Theory","room":"211"},
      {"id":"e0216","day":"Wednesday","time":"10:45","minutes":645,"duration":50,"course":"PH4110","type":"Theory","room":"112"},
      {"id":"e0217","day":"Wednesday","time":"11:40","minutes":700,"duration":50,"course":"CH2105","type":"Theory","room":"S N Bose Lecture Theatre"},
      {"id":"e0218","day":"Wednesday","time":"11:40","minutes":700,"duration":50,"course":"CH3104","type":"Theory","room":"G02"},
      {"id":"e0219","day":"Wednesday","time":"11:40","minutes":700,"duration":50,"course":"CH4105","type":"Theory","room":"101"},
      {"id":"e0220","day":"Wednesday","time":"11:40","minutes":700,"duration":50,"course":"CH4122","type":"Theory","room":"108"},
      {"id":"e0221","day":"Wednesday","time":"11:40","minutes":700,"duration":50,"course":"LS4102","type":"Theory","room":"102"},
      {"id":"e0222","day":"Wednesday","time":"11:40","minutes":700,"duration":50,"course":"LS4113","type":"Theory","room":"111"},
      {"id":"e0223","day":"Wednesday","time":"11:40","minutes":700,"duration":50,"course":"MA3108","type":"Theory","room":"G09"},
      {"id":"e0224","day":"Wednesday","time":"11:40","minutes":700,"duration":50,"course":"MA5125","type":"Theory","room":"211"},
      {"id":"e0225","day":"Wednesday","time":"11:40","minutes":700,"duration":50,"course":"PH4113","type":"Theory","room":"G08"},
      {"id":"e0226","day":"Wednesday","time":"13:30","minutes":810,"duration":160,"course":"CH2103","type":"Lab","room":"DCS 2nd Year Lab"},
      {"id":"e0227","day":"Wednesday","time":"13:30","minutes":810,"duration":50,"course":"CS2102","type":"Theory","room":"Ramanujan Virtual Classroom"},
      {"id":"e0228","day":"Wednesday","time":"13:30","minutes":810,"duration":160,"course":"CS3102","type":"Lab","room":"Computer Lab 2"},
      {"id":"e0229","day":"Wednesday","time":"13:30","minutes":810,"duration":160,"course":"ES2105","type":"Lab","room":"DES 2nd Year Lab"},
      {"id":"e0230","day":"Wednesday","time":"13:30","minutes":810,"duration":160,"course":"LS2102","type":"Lab","room":"DBS 2nd Year Lab"},
      {"id":"e0231","day":"Wednesday","time":"13:30","minutes":810,"duration":160,"course":"PH2103","type":"Lab","room":"DPS 2nd Year Lab"},
      {"id":"e0232","day":"Wednesday","time":"13:30","minutes":810,"duration":160,"course":"PH3105","type":"Lab","room":"DPS 3rd Year Lab 1"},
      {"id":"e0233","day":"Wednesday","time":"13:30","minutes":810,"duration":160,"course":"PH4103","type":"Lab","room":"DBS 4th Year Lab"},
      {"id":"e0234","day":"Wednesday","time":"16:15","minutes":975,"duration":50,"course":"CH4121","type":"Theory","room":"103"},
      {"id":"e0235","day":"Wednesday","time":"16:15","minutes":975,"duration":50,"course":"CH4126","type":"Theory","room":"201"},
      {"id":"e0236","day":"Wednesday","time":"16:15","minutes":975,"duration":50,"course":"ES3101","type":"Theory","room":"101"},
      {"id":"e0237","day":"Wednesday","time":"16:15","minutes":975,"duration":50,"course":"ES4108","type":"Theory","room":"108"},
      {"id":"e0238","day":"Wednesday","time":"16:15","minutes":975,"duration":50,"course":"LS4101","type":"Theory","room":"102"},
      {"id":"e0239","day":"Wednesday","time":"16:15","minutes":975,"duration":50,"course":"MA2102","type":"Theory","room":"Ramanujan Virtual Classroom"},
      {"id":"e0240","day":"Wednesday","time":"16:15","minutes":975,"duration":50,"course":"MA4102","type":"Theory","room":"G09"},
      {"id":"e0241","day":"Wednesday","time":"16:15","minutes":975,"duration":50,"course":"PH3101","type":"Theory","room":"G02"},
      {"id":"e0242","day":"Wednesday","time":"16:15","minutes":975,"duration":50,"course":"PH4107","type":"Theory","room":"112"},
      {"id":"e0243","day":"Wednesday","time":"17:10","minutes":1030,"duration":50,"course":"CH4121","type":"Tutorial","room":"103"},
      {"id":"e0244","day":"Wednesday","time":"17:10","minutes":1030,"duration":50,"course":"CH4126","type":"Tutorial","room":"201"},
      {"id":"e0245","day":"Wednesday","time":"17:10","minutes":1030,"duration":50,"course":"ES3101","type":"Tutorial","room":"101"},
      {"id":"e0246","day":"Wednesday","time":"17:10","minutes":1030,"duration":50,"course":"ES4108","type":"Tutorial","room":"108"},
      {"id":"e0247","day":"Wednesday","time":"17:10","minutes":1030,"duration":50,"course":"LS4101","type":"Tutorial","room":"102"},
      {"id":"e0248","day":"Wednesday","time":"17:10","minutes":1030,"duration":50,"course":"MA4102","type":"Tutorial","room":"G09"},
      {"id":"e0249","day":"Wednesday","time":"17:10","minutes":1030,"duration":50,"course":"PH3101","type":"Tutorial","room":"G02"},
      {"id":"e0250","day":"Wednesday","time":"17:10","minutes":1030,"duration":50,"course":"PH4107","type":"Tutorial","room":"112"},
      {"id":"e0251","day":"Thursday","time":"08:00","minutes":480,"duration":50,"course":"CH2102","type":"Tutorial","room":"S N Bose Lecture Theatre"},
      {"id":"e0252","day":"Thursday","time":"08:00","minutes":480,"duration":50,"course":"CH4104","type":"Tutorial","room":"110"},
      {"id":"e0253","day":"Thursday","time":"08:00","minutes":480,"duration":50,"course":"CH4106","type":"Tutorial","room":"101"},
      {"id":"e0254","day":"Thursday","time":"08:00","minutes":480,"duration":50,"course":"CH4127","type":"Tutorial","room":"108"},
      {"id":"e0255","day":"Thursday","time":"08:00","minutes":480,"duration":50,"course":"ES3103","type":"Tutorial","room":"101"},
      {"id":"e0256","day":"Thursday","time":"08:00","minutes":480,"duration":50,"course":"LS3102","type":"Tutorial","room":"102"},
      {"id":"e0257","day":"Thursday","time":"08:00","minutes":480,"duration":50,"course":"LS4106","type":"Tutorial","room":"111"},
      {"id":"e0258","day":"Thursday","time":"08:00","minutes":480,"duration":50,"course":"MA3104","type":"Tutorial","room":"G09"},
      {"id":"e0259","day":"Thursday","time":"08:00","minutes":480,"duration":50,"course":"MA4112","type":"Tutorial","room":"209"},
      {"id":"e0260","day":"Thursday","time":"08:00","minutes":480,"duration":50,"course":"MA5102","type":"Tutorial","room":"211"},
      {"id":"e0261","day":"Thursday","time":"08:00","minutes":480,"duration":50,"course":"PH4102","type":"Tutorial","room":"D N Wadia Lecture Theatre"},
      {"id":"e0262","day":"Thursday","time":"08:00","minutes":480,"duration":50,"course":"PH4106","type":"Tutorial","room":"103"},
      {"id":"e0263","day":"Thursday","time":"08:00","minutes":480,"duration":50,"course":"PH5113","type":"Tutorial","room":"111"},
      {"id":"e0264","day":"Thursday","time":"08:55","minutes":535,"duration":50,"course":"CH4104","type":"Theory","room":"110"},
      {"id":"e0265","day":"Thursday","time":"08:55","minutes":535,"duration":50,"course":"CH4106","type":"Theory","room":"101"},
      {"id":"e0266","day":"Thursday","time":"08:55","minutes":535,"duration":50,"course":"CH4127","type":"Theory","room":"108"},
      {"id":"e0267","day":"Thursday","time":"08:55","minutes":535,"duration":50,"course":"ES3103","type":"Theory","room":"101"},
      {"id":"e0268","day":"Thursday","time":"08:55","minutes":535,"duration":50,"course":"LS3102","type":"Theory","room":"102"},
      {"id":"e0269","day":"Thursday","time":"08:55","minutes":535,"duration":50,"course":"LS4106","type":"Theory","room":"111"},
      {"id":"e0270","day":"Thursday","time":"08:55","minutes":535,"duration":50,"course":"LS5101","type":"Theory","room":"108"},
      {"id":"e0271","day":"Thursday","time":"08:55","minutes":535,"duration":50,"course":"MA2101","type":"Tutorial","room":"Ramanujan Virtual Classroom"},
      {"id":"e0272","day":"Thursday","time":"08:55","minutes":535,"duration":50,"course":"MA3104","type":"Theory","room":"G09"},
      {"id":"e0273","day":"Thursday","time":"08:55","minutes":535,"duration":50,"course":"MA4112","type":"Theory","room":"209"},
      {"id":"e0274","day":"Thursday","time":"08:55","minutes":535,"duration":50,"course":"MA5102","type":"Theory","room":"211"},
      {"id":"e0275","day":"Thursday","time":"08:55","minutes":535,"duration":50,"course":"PH4102","type":"Theory","room":"D N Wadia Lecture Theatre"},
      {"id":"e0276","day":"Thursday","time":"08:55","minutes":535,"duration":50,"course":"PH4106","type":"Theory","room":"103"},
      {"id":"e0277","day":"Thursday","time":"08:55","minutes":535,"duration":50,"course":"PH5113","type":"Theory","room":"111"},
      {"id":"e0278","day":"Thursday","time":"09:50","minutes":590,"duration":50,"course":"CH3101","type":"Theory","room":"G08"},
      {"id":"e0279","day":"Thursday","time":"09:50","minutes":590,"duration":50,"course":"CH4102","type":"Theory","room":"102"},
      {"id":"e0280","day":"Thursday","time":"09:50","minutes":590,"duration":50,"course":"CH5102","type":"Theory","room":"201"},
      {"id":"e0281","day":"Thursday","time":"09:50","minutes":590,"duration":50,"course":"ES4101","type":"Theory","room":"101"},
      {"id":"e0282","day":"Thursday","time":"09:50","minutes":590,"duration":50,"course":"LS4103","type":"Theory","room":"103"},
      {"id":"e0283","day":"Thursday","time":"09:50","minutes":590,"duration":50,"course":"MA3101","type":"Theory","room":"G09"},
      {"id":"e0284","day":"Thursday","time":"09:50","minutes":590,"duration":50,"course":"MA4110","type":"Theory","room":"211"},
      {"id":"e0285","day":"Thursday","time":"09:50","minutes":590,"duration":50,"course":"PH4110","type":"Theory","room":"112"},
      {"id":"e0286","day":"Thursday","time":"10:45","minutes":645,"duration":50,"course":"CH3106","type":"Theory","room":"102"},
      {"id":"e0287","day":"Thursday","time":"10:45","minutes":645,"duration":50,"course":"CH4115","type":"Theory","room":"G09"},
      {"id":"e0288","day":"Thursday","time":"10:45","minutes":645,"duration":50,"course":"CH4116","type":"Theory","room":"101"},
      {"id":"e0289","day":"Thursday","time":"10:45","minutes":645,"duration":50,"course":"CS4103","type":"Theory","room":"G02"},
      {"id":"e0290","day":"Thursday","time":"10:45","minutes":645,"duration":50,"course":"HU4102","type":"Theory","room":"111"},
      {"id":"e0291","day":"Thursday","time":"10:45","minutes":645,"duration":50,"course":"HU4103","type":"Theory","room":"108"},
      {"id":"e0292","day":"Thursday","time":"10:45","minutes":645,"duration":50,"course":"LS2103","type":"Tutorial","room":"Ramanujan Virtual Classroom"},
      {"id":"e0293","day":"Thursday","time":"10:45","minutes":645,"duration":50,"course":"LS4105","type":"Theory","room":"112"},
      {"id":"e0294","day":"Thursday","time":"10:45","minutes":645,"duration":50,"course":"MA3103","type":"Theory","room":"211"},
      {"id":"e0295","day":"Thursday","time":"10:45","minutes":645,"duration":50,"course":"PH5114","type":"Theory","room":"201"},
      {"id":"e0296","day":"Thursday","time":"11:40","minutes":700,"duration":50,"course":"ES2103","type":"Theory","room":"Ramanujan Virtual Classroom"},
      {"id":"e0297","day":"Thursday","time":"11:40","minutes":700,"duration":50,"course":"LS3101","type":"Theory","room":"102"},
      {"id":"e0298","day":"Thursday","time":"11:40","minutes":700,"duration":50,"course":"LS5101","type":"Theory","room":"108"},
      {"id":"e0299","day":"Thursday","time":"11:40","minutes":700,"duration":50,"course":"MA3109","type":"Theory","room":"G09"},
      {"id":"e0300","day":"Thursday","time":"11:40","minutes":700,"duration":50,"course":"MA5126","type":"Theory","room":"211"},
      {"id":"e0301","day":"Thursday","time":"11:40","minutes":700,"duration":50,"course":"PH3102","type":"Theory","room":"G02"},
      {"id":"e0302","day":"Thursday","time":"13:30","minutes":810,"duration":160,"course":"CH3105","type":"Lab","room":"DCS 3rd Year Lab 1"},
      {"id":"e0303","day":"Thursday","time":"13:30","minutes":810,"duration":160,"course":"CH4118","type":"Lab","room":"DCS 4th Year Lab"},
      {"id":"e0304","day":"Thursday","time":"13:30","minutes":810,"duration":160,"course":"CH4123","type":"Lab","room":"DCS 4th Year Lab 1"},
      {"id":"e0305","day":"Thursday","time":"13:30","minutes":810,"duration":160,"course":"CH4124","type":"Lab","room":"DCS 4th Year Lab 2"},
      {"id":"e0306","day":"Thursday","time":"13:30","minutes":810,"duration":160,"course":"ES3102","type":"Lab","room":"DES 3rd Year Lab"},
      {"id":"e0307","day":"Thursday","time":"13:30","minutes":810,"duration":160,"course":"ES3104","type":"Lab","room":"DES 3rd Year Lab 1"},
      {"id":"e0308","day":"Thursday","time":"13:30","minutes":810,"duration":160,"course":"ES4102","type":"Lab","room":"DES 4th Year Lab"},
      {"id":"e0309","day":"Thursday","time":"13:30","minutes":810,"duration":160,"course":"ES4104","type":"Lab","room":"DES 4th Year Lab 1"},
      {"id":"e0310","day":"Thursday","time":"13:30","minutes":810,"duration":160,"course":"ES4106","type":"Lab","room":"DES 4th Year Lab 2"},
      {"id":"e0311","day":"Thursday","time":"13:30","minutes":810,"duration":160,"course":"LS3104","type":"Lab","room":"DBS 3rd Year Lab"},
      {"id":"e0312","day":"Thursday","time":"13:30","minutes":810,"duration":160,"course":"LS3105","type":"Lab","room":"DBS 3rd Year Lab 1"},
      {"id":"e0313","day":"Thursday","time":"13:30","minutes":810,"duration":160,"course":"LS3106","type":"Lab","room":"DBS 3rd Year Lab 2"},
      {"id":"e0314","day":"Thursday","time":"13:30","minutes":810,"duration":160,"course":"LS4104","type":"Lab","room":"DBS 4th Year Lab"},
      {"id":"e0315","day":"Thursday","time":"13:30","minutes":810,"duration":160,"course":"LS4114","type":"Lab","room":"DBS 4th Year Lab 1"},
      {"id":"e0316","day":"Thursday","time":"13:30","minutes":810,"duration":160,"course":"MA4111","type":"Lab","room":"DMS 4th Year Lab"},
      {"id":"e0317","day":"Thursday","time":"13:30","minutes":810,"duration":50,"course":"PH2101","type":"Theory","room":"S N Bose Lecture Theatre"},
      {"id":"e0318","day":"Thursday","time":"13:30","minutes":810,"duration":160,"course":"PH3105","type":"Lab","room":"DPS 3rd Year Lab"},
      {"id":"e0319","day":"Thursday","time":"13:30","minutes":810,"duration":160,"course":"PH4103","type":"Lab","room":"DPS 4th Year Lab"},
      {"id":"e0320","day":"Thursday","time":"14:25","minutes":865,"duration":50,"course":"MA2101","type":"Theory","room":"Ramanujan Virtual Classroom"},
      {"id":"e0321","day":"Thursday","time":"15:20","minutes":920,"duration":50,"course":"PH2104","type":"Theory","room":"S N Bose Lecture Theatre"},
      {"id":"e0322","day":"Thursday","time":"16:15","minutes":975,"duration":50,"course":"CH3103","type":"Theory","room":"G02"},
      {"id":"e0323","day":"Thursday","time":"16:15","minutes":975,"duration":50,"course":"CH4120","type":"Theory","room":"111"},
      {"id":"e0324","day":"Thursday","time":"16:15","minutes":975,"duration":50,"course":"ES3108","type":"Theory","room":"101"},
      {"id":"e0325","day":"Thursday","time":"16:15","minutes":975,"duration":50,"course":"LS2101","type":"Theory","room":"S N Bose Lecture Theatre"},
      {"id":"e0326","day":"Thursday","time":"16:15","minutes":975,"duration":50,"course":"LS4109","type":"Theory","room":"G09"},
      {"id":"e0327","day":"Thursday","time":"16:15","minutes":975,"duration":50,"course":"LS5103","type":"Theory","room":"108"},
      {"id":"e0328","day":"Thursday","time":"16:15","minutes":975,"duration":50,"course":"MA5122","type":"Theory","room":"211"},
      {"id":"e0329","day":"Thursday","time":"16:15","minutes":975,"duration":50,"course":"PH4104","type":"Theory","room":"102"},
      {"id":"e0330","day":"Thursday","time":"16:15","minutes":975,"duration":50,"course":"PH5103","type":"Theory","room":"112"},
      {"id":"e0331","day":"Thursday","time":"17:10","minutes":1030,"duration":50,"course":"CH3103","type":"Tutorial","room":"G02"},
      {"id":"e0332","day":"Thursday","time":"17:10","minutes":1030,"duration":50,"course":"CH4120","type":"Tutorial","room":"111"},
      {"id":"e0333","day":"Thursday","time":"17:10","minutes":1030,"duration":50,"course":"CS2101","type":"Tutorial","room":"Ramanujan Virtual Classroom"},
      {"id":"e0334","day":"Thursday","time":"17:10","minutes":1030,"duration":50,"course":"ES2104","type":"Tutorial","room":"D N Wadia Lecture Theatre"},
      {"id":"e0335","day":"Thursday","time":"17:10","minutes":1030,"duration":50,"course":"ES3108","type":"Tutorial","room":"101"},
      {"id":"e0336","day":"Thursday","time":"17:10","minutes":1030,"duration":50,"course":"LS4109","type":"Tutorial","room":"G09"},
      {"id":"e0337","day":"Thursday","time":"17:10","minutes":1030,"duration":50,"course":"LS5103","type":"Tutorial","room":"108"},
      {"id":"e0338","day":"Thursday","time":"17:10","minutes":1030,"duration":50,"course":"PH4104","type":"Tutorial","room":"102"},
      {"id":"e0339","day":"Thursday","time":"17:10","minutes":1030,"duration":50,"course":"PH5103","type":"Tutorial","room":"112"},
      {"id":"e0340","day":"Friday","time":"08:00","minutes":480,"duration":50,"course":"CH4111","type":"Tutorial","room":"G09"},
      {"id":"e0341","day":"Friday","time":"08:00","minutes":480,"duration":50,"course":"CH4125","type":"Tutorial","room":"108"},
      {"id":"e0342","day":"Friday","time":"08:00","minutes":480,"duration":50,"course":"CH5103","type":"Tutorial","room":"201"},
      {"id":"e0343","day":"Friday","time":"08:00","minutes":480,"duration":50,"course":"ES4107","type":"Tutorial","room":"111"},
      {"id":"e0344","day":"Friday","time":"08:00","minutes":480,"duration":50,"course":"LS2101","type":"Tutorial","room":"S N Bose Lecture Theatre"},
      {"id":"e0345","day":"Friday","time":"08:00","minutes":480,"duration":50,"course":"LS4107","type":"Tutorial","room":"102"},
      {"id":"e0346","day":"Friday","time":"08:00","minutes":480,"duration":50,"course":"LS4112","type":"Tutorial","room":"112"},
      {"id":"e0347","day":"Friday","time":"08:00","minutes":480,"duration":50,"course":"MA4104","type":"Tutorial","room":"211"},
      {"id":"e0348","day":"Friday","time":"08:00","minutes":480,"duration":50,"course":"PH3103","type":"Tutorial","room":"G02"},
      {"id":"e0349","day":"Friday","time":"08:55","minutes":535,"duration":50,"course":"CH4111","type":"Theory","room":"G09"},
      {"id":"e0350","day":"Friday","time":"08:55","minutes":535,"duration":50,"course":"CH4125","type":"Theory","room":"108"},
      {"id":"e0351","day":"Friday","time":"08:55","minutes":535,"duration":50,"course":"CH5103","type":"Theory","room":"201"},
      {"id":"e0352","day":"Friday","time":"08:55","minutes":535,"duration":50,"course":"ES4107","type":"Theory","room":"111"},
      {"id":"e0353","day":"Friday","time":"08:55","minutes":535,"duration":50,"course":"LS4107","type":"Theory","room":"102"},
      {"id":"e0354","day":"Friday","time":"08:55","minutes":535,"duration":50,"course":"LS4112","type":"Theory","room":"112"},
      {"id":"e0355","day":"Friday","time":"08:55","minutes":535,"duration":50,"course":"MA2104","type":"Theory","room":"Ramanujan Virtual Classroom"},
      {"id":"e0356","day":"Friday","time":"08:55","minutes":535,"duration":50,"course":"MA4104","type":"Theory","room":"211"},
      {"id":"e0357","day":"Friday","time":"08:55","minutes":535,"duration":50,"course":"PH3103","type":"Theory","room":"G02"},
      {"id":"e0358","day":"Friday","time":"09:50","minutes":590,"duration":50,"course":"CH2104","type":"Tutorial","room":"D N Wadia Lecture Theatre"},
      {"id":"e0359","day":"Friday","time":"09:50","minutes":590,"duration":50,"course":"CH2104","type":"Tutorial","room":"Ramanujan Virtual Classroom"},
      {"id":"e0360","day":"Friday","time":"09:50","minutes":590,"duration":50,"course":"CH4114","type":"Theory","room":"209"},
      {"id":"e0361","day":"Friday","time":"09:50","minutes":590,"duration":50,"course":"CH4117","type":"Theory","room":"108"},
      {"id":"e0362","day":"Friday","time":"09:50","minutes":590,"duration":50,"course":"CH5104","type":"Theory","room":"212"},
      {"id":"e0363","day":"Friday","time":"09:50","minutes":590,"duration":50,"course":"ES3105","type":"Theory","room":"102"},
      {"id":"e0364","day":"Friday","time":"09:50","minutes":590,"duration":50,"course":"ES4103","type":"Theory","room":"112"},
      {"id":"e0365","day":"Friday","time":"09:50","minutes":590,"duration":50,"course":"LS3103","type":"Theory","room":"103"},
      {"id":"e0366","day":"Friday","time":"09:50","minutes":590,"duration":50,"course":"LS4115","type":"Theory","room":"111"},
      {"id":"e0367","day":"Friday","time":"09:50","minutes":590,"duration":50,"course":"MA3110","type":"Theory","room":"G09"},
      {"id":"e0368","day":"Friday","time":"09:50","minutes":590,"duration":50,"course":"MA4107","type":"Theory","room":"211"},
      {"id":"e0369","day":"Friday","time":"09:50","minutes":590,"duration":50,"course":"PH4108","type":"Theory","room":"201"},
      {"id":"e0370","day":"Friday","time":"10:45","minutes":645,"duration":50,"course":"CH3102","type":"Theory","room":"G02"},
      {"id":"e0371","day":"Friday","time":"10:45","minutes":645,"duration":50,"course":"CH4107","type":"Theory","room":"110"},
      {"id":"e0372","day":"Friday","time":"10:45","minutes":645,"duration":50,"course":"CH4128","type":"Theory","room":"101"},
      {"id":"e0373","day":"Friday","time":"10:45","minutes":645,"duration":50,"course":"ES4105","type":"Theory","room":"108"},
      {"id":"e0374","day":"Friday","time":"10:45","minutes":645,"duration":50,"course":"MA4101","type":"Theory","room":"G09"},
      {"id":"e0375","day":"Friday","time":"10:45","minutes":645,"duration":50,"course":"MA4106","type":"Theory","room":"211"},
      {"id":"e0376","day":"Friday","time":"10:45","minutes":645,"duration":50,"course":"PH3104","type":"Theory","room":"G08"},
      {"id":"e0377","day":"Friday","time":"10:45","minutes":645,"duration":50,"course":"PH4101","type":"Theory","room":"D N Wadia Lecture Theatre"},
      {"id":"e0378","day":"Friday","time":"11:40","minutes":700,"duration":50,"course":"CH3106","type":"Theory","room":"102"},
      {"id":"e0379","day":"Friday","time":"11:40","minutes":700,"duration":50,"course":"CH4115","type":"Theory","room":"G09"},
      {"id":"e0380","day":"Friday","time":"11:40","minutes":700,"duration":50,"course":"CH4116","type":"Theory","room":"101"},
      {"id":"e0381","day":"Friday","time":"11:40","minutes":700,"duration":50,"course":"CS4103","type":"Theory","room":"G02"},
      {"id":"e0382","day":"Friday","time":"11:40","minutes":700,"duration":50,"course":"HU4102","type":"Theory","room":"111"},
      {"id":"e0383","day":"Friday","time":"11:40","minutes":700,"duration":50,"course":"HU4103","type":"Theory","room":"108"},
      {"id":"e0384","day":"Friday","time":"11:40","minutes":700,"duration":50,"course":"LS4105","type":"Theory","room":"112"},
      {"id":"e0385","day":"Friday","time":"11:40","minutes":700,"duration":50,"course":"MA2102","type":"Theory","room":"Ramanujan Virtual Classroom"},
      {"id":"e0386","day":"Friday","time":"11:40","minutes":700,"duration":50,"course":"MA3103","type":"Theory","room":"211"},
      {"id":"e0387","day":"Friday","time":"11:40","minutes":700,"duration":50,"course":"PH5114","type":"Theory","room":"201"},
      {"id":"e0388","day":"Friday","time":"13:30","minutes":810,"duration":160,"course":"CH2103","type":"Lab","room":"DCS 2nd Year Lab"},
      {"id":"e0389","day":"Friday","time":"13:30","minutes":810,"duration":50,"course":"CH3103","type":"Theory","room":"G02"},
      {"id":"e0390","day":"Friday","time":"13:30","minutes":810,"duration":160,"course":"CS2103","type":"Lab","room":"Computer Lab 1"},
      {"id":"e0391","day":"Friday","time":"13:30","minutes":810,"duration":160,"course":"ES2105","type":"Lab","room":"DES 2nd Year Lab"},
      {"id":"e0392","day":"Friday","time":"13:30","minutes":810,"duration":50,"course":"ES3108","type":"Theory","room":"101"},
      {"id":"e0393","day":"Friday","time":"13:30","minutes":810,"duration":160,"course":"LS2102","type":"Lab","room":"DBS 2nd Year Lab"},
      {"id":"e0394","day":"Friday","time":"13:30","minutes":810,"duration":50,"course":"LS4109","type":"Theory","room":"G09"},
      {"id":"e0395","day":"Friday","time":"13:30","minutes":810,"duration":50,"course":"LS5103","type":"Theory","room":"108"},
      {"id":"e0396","day":"Friday","time":"13:30","minutes":810,"duration":50,"course":"MA5122","type":"Theory","room":"211"},
      {"id":"e0397","day":"Friday","time":"13:30","minutes":810,"duration":160,"course":"PH2103","type":"Lab","room":"DPS 2nd Year Lab"},
      {"id":"e0398","day":"Friday","time":"13:30","minutes":810,"duration":50,"course":"PH4104","type":"Theory","room":"102"},
      {"id":"e0399","day":"Friday","time":"13:30","minutes":810,"duration":50,"course":"PH5103","type":"Theory","room":"112"},
      {"id":"e0400","day":"Friday","time":"14:25","minutes":865,"duration":50,"course":"CH4121","type":"Theory","room":"103"},
      {"id":"e0401","day":"Friday","time":"14:25","minutes":865,"duration":50,"course":"CH4126","type":"Theory","room":"201"},
      {"id":"e0402","day":"Friday","time":"14:25","minutes":865,"duration":50,"course":"ES3101","type":"Theory","room":"101"},
      {"id":"e0403","day":"Friday","time":"14:25","minutes":865,"duration":50,"course":"ES4108","type":"Theory","room":"108"},
      {"id":"e0404","day":"Friday","time":"14:25","minutes":865,"duration":50,"course":"LS4101","type":"Theory","room":"102"},
      {"id":"e0405","day":"Friday","time":"14:25","minutes":865,"duration":50,"course":"MA4102","type":"Theory","room":"G09"},
      {"id":"e0406","day":"Friday","time":"14:25","minutes":865,"duration":50,"course":"PH3101","type":"Theory","room":"G02"},
      {"id":"e0407","day":"Friday","time":"14:25","minutes":865,"duration":50,"course":"PH4107","type":"Theory","room":"112"},
      {"id":"e0408","day":"Friday","time":"15:20","minutes":920,"duration":50,"course":"CH3104","type":"Theory","room":"G02"},
      {"id":"e0409","day":"Friday","time":"15:20","minutes":920,"duration":50,"course":"CH4105","type":"Theory","room":"101"},
      {"id":"e0410","day":"Friday","time":"15:20","minutes":920,"duration":50,"course":"CH4109","type":"Theory","room":"112"},
      {"id":"e0411","day":"Friday","time":"15:20","minutes":920,"duration":50,"course":"CH4122","type":"Theory","room":"108"},
      {"id":"e0412","day":"Friday","time":"15:20","minutes":920,"duration":50,"course":"LS2101","type":"Theory","room":"S N Bose Lecture Theatre"},
      {"id":"e0413","day":"Friday","time":"15:20","minutes":920,"duration":50,"course":"LS4102","type":"Theory","room":"102"},
      {"id":"e0414","day":"Friday","time":"15:20","minutes":920,"duration":50,"course":"LS4113","type":"Theory","room":"111"},
      {"id":"e0415","day":"Friday","time":"15:20","minutes":920,"duration":50,"course":"MA3108","type":"Theory","room":"G09"},
      {"id":"e0416","day":"Friday","time":"15:20","minutes":920,"duration":50,"course":"MA5125","type":"Theory","room":"211"},
      {"id":"e0417","day":"Friday","time":"15:20","minutes":920,"duration":50,"course":"PH4113","type":"Theory","room":"G08"},
      {"id":"e0418","day":"Friday","time":"16:15","minutes":975,"duration":50,"course":"CH3101","type":"Theory","room":"G08"},
      {"id":"e0419","day":"Friday","time":"16:15","minutes":975,"duration":50,"course":"CH4102","type":"Theory","room":"102"},
      {"id":"e0420","day":"Friday","time":"16:15","minutes":975,"duration":50,"course":"CH5102","type":"Theory","room":"201"},
      {"id":"e0421","day":"Friday","time":"16:15","minutes":975,"duration":50,"course":"CS2101","type":"Theory","room":"Ramanujan Virtual Classroom"},
      {"id":"e0422","day":"Friday","time":"16:15","minutes":975,"duration":50,"course":"ES4101","type":"Theory","room":"101"},
      {"id":"e0423","day":"Friday","time":"16:15","minutes":975,"duration":50,"course":"LS4103","type":"Theory","room":"103"},
      {"id":"e0424","day":"Friday","time":"16:15","minutes":975,"duration":50,"course":"MA3101","type":"Theory","room":"G09"},
      {"id":"e0425","day":"Friday","time":"16:15","minutes":975,"duration":50,"course":"PH4110","type":"Theory","room":"112"},
      {"id":"e0426","day":"Friday","time":"17:10","minutes":1030,"duration":50,"course":"CH3101","type":"Tutorial","room":"G08"},
      {"id":"e0427","day":"Friday","time":"17:10","minutes":1030,"duration":50,"course":"CH4102","type":"Tutorial","room":"102"},
      {"id":"e0428","day":"Friday","time":"17:10","minutes":1030,"duration":50,"course":"CH5102","type":"Tutorial","room":"201"},
      {"id":"e0429","day":"Friday","time":"17:10","minutes":1030,"duration":50,"course":"ES4101","type":"Tutorial","room":"101"},
      {"id":"e0430","day":"Friday","time":"17:10","minutes":1030,"duration":50,"course":"LS4103","type":"Tutorial","room":"103"},
      {"id":"e0431","day":"Friday","time":"17:10","minutes":1030,"duration":50,"course":"MA3101","type":"Tutorial","room":"G09"},
      {"id":"e0432","day":"Friday","time":"17:10","minutes":1030,"duration":50,"course":"MA4110","type":"Tutorial","room":"211"},
      {"id":"e0433","day":"Friday","time":"17:10","minutes":1030,"duration":50,"course":"PH4110","type":"Tutorial","room":"112"}
    ]
  };

  global.TIMETABLE_DATA = DATA;
})(typeof globalThis !== 'undefined' ? globalThis : self);
