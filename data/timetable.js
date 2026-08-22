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
     *   id       - stable content-derived key; user customisations in
     *                localStorage are stored against it, so it must not change
     *                for a given class between dataset versions
     *   day      - 'Monday' ... 'Friday'
     *   time     - 24h start time, 'HH:MM'
     *   minutes  - start time as minutes since midnight (sortable)
     *   duration - length in minutes (see durations above)
     *   course   - course code exactly as published
     *   type     - 'Theory' | 'Tutorial' | 'Lab'
     *   room     - room/location exactly as published
     */
    events: [
      {"id":"mon-0800-ch3102-tutorial-g02","day":"Monday","time":"08:00","minutes":480,"duration":50,"course":"CH3102","type":"Tutorial","room":"G02"},
      {"id":"mon-0800-ch4106-tutorial-101","day":"Monday","time":"08:00","minutes":480,"duration":50,"course":"CH4106","type":"Tutorial","room":"101"},
      {"id":"mon-0800-ch4107-tutorial-102","day":"Monday","time":"08:00","minutes":480,"duration":50,"course":"CH4107","type":"Tutorial","room":"102"},
      {"id":"mon-0800-ch4128-tutorial-101","day":"Monday","time":"08:00","minutes":480,"duration":50,"course":"CH4128","type":"Tutorial","room":"101"},
      {"id":"mon-0800-es4105-tutorial-108","day":"Monday","time":"08:00","minutes":480,"duration":50,"course":"ES4105","type":"Tutorial","room":"108"},
      {"id":"mon-0800-ma2102-tutorial-ramanujan-virtual-classroom","day":"Monday","time":"08:00","minutes":480,"duration":50,"course":"MA2102","type":"Tutorial","room":"Ramanujan Virtual Classroom"},
      {"id":"mon-0800-ma4101-tutorial-g09","day":"Monday","time":"08:00","minutes":480,"duration":50,"course":"MA4101","type":"Tutorial","room":"G09"},
      {"id":"mon-0800-ma4106-tutorial-211","day":"Monday","time":"08:00","minutes":480,"duration":50,"course":"MA4106","type":"Tutorial","room":"211"},
      {"id":"mon-0800-ph3104-tutorial-g08","day":"Monday","time":"08:00","minutes":480,"duration":50,"course":"PH3104","type":"Tutorial","room":"G08"},
      {"id":"mon-0800-ph4101-tutorial-110","day":"Monday","time":"08:00","minutes":480,"duration":50,"course":"PH4101","type":"Tutorial","room":"110"},
      {"id":"mon-0855-ch3102-theory-g02","day":"Monday","time":"08:55","minutes":535,"duration":50,"course":"CH3102","type":"Theory","room":"G02"},
      {"id":"mon-0855-ch4106-theory-101","day":"Monday","time":"08:55","minutes":535,"duration":50,"course":"CH4106","type":"Theory","room":"101"},
      {"id":"mon-0855-ch4107-theory-102","day":"Monday","time":"08:55","minutes":535,"duration":50,"course":"CH4107","type":"Theory","room":"102"},
      {"id":"mon-0855-ch4128-theory-101","day":"Monday","time":"08:55","minutes":535,"duration":50,"course":"CH4128","type":"Theory","room":"101"},
      {"id":"mon-0855-es2104-theory-ramanujan-virtual-classroom","day":"Monday","time":"08:55","minutes":535,"duration":50,"course":"ES2104","type":"Theory","room":"Ramanujan Virtual Classroom"},
      {"id":"mon-0855-es4105-theory-108","day":"Monday","time":"08:55","minutes":535,"duration":50,"course":"ES4105","type":"Theory","room":"108"},
      {"id":"mon-0855-ma4101-theory-g09","day":"Monday","time":"08:55","minutes":535,"duration":50,"course":"MA4101","type":"Theory","room":"G09"},
      {"id":"mon-0855-ma4106-theory-211","day":"Monday","time":"08:55","minutes":535,"duration":50,"course":"MA4106","type":"Theory","room":"211"},
      {"id":"mon-0855-ph3104-theory-g08","day":"Monday","time":"08:55","minutes":535,"duration":50,"course":"PH3104","type":"Theory","room":"G08"},
      {"id":"mon-0855-ph4101-theory-110","day":"Monday","time":"08:55","minutes":535,"duration":50,"course":"PH4101","type":"Theory","room":"110"},
      {"id":"mon-0950-ls3101-theory-102","day":"Monday","time":"09:50","minutes":590,"duration":50,"course":"LS3101","type":"Theory","room":"102"},
      {"id":"mon-0950-ls4106-theory-111","day":"Monday","time":"09:50","minutes":590,"duration":50,"course":"LS4106","type":"Theory","room":"111"},
      {"id":"mon-0950-ls5101-theory-108","day":"Monday","time":"09:50","minutes":590,"duration":50,"course":"LS5101","type":"Theory","room":"108"},
      {"id":"mon-0950-ma3109-theory-g09","day":"Monday","time":"09:50","minutes":590,"duration":50,"course":"MA3109","type":"Theory","room":"G09"},
      {"id":"mon-0950-ma4112-theory-209","day":"Monday","time":"09:50","minutes":590,"duration":50,"course":"MA4112","type":"Theory","room":"209"},
      {"id":"mon-0950-ma5126-theory-211","day":"Monday","time":"09:50","minutes":590,"duration":50,"course":"MA5126","type":"Theory","room":"211"},
      {"id":"mon-0950-ph2101-theory-s-n-bose-lecture-theatre","day":"Monday","time":"09:50","minutes":590,"duration":50,"course":"PH2101","type":"Theory","room":"S N Bose Lecture Theatre"},
      {"id":"mon-0950-ph3102-theory-g02","day":"Monday","time":"09:50","minutes":590,"duration":50,"course":"PH3102","type":"Theory","room":"G02"},
      {"id":"mon-0950-ph4106-theory-103","day":"Monday","time":"09:50","minutes":590,"duration":50,"course":"PH4106","type":"Theory","room":"103"},
      {"id":"mon-1045-ch4104-theory-110","day":"Monday","time":"10:45","minutes":645,"duration":50,"course":"CH4104","type":"Theory","room":"110"},
      {"id":"mon-1045-ch4127-theory-108","day":"Monday","time":"10:45","minutes":645,"duration":50,"course":"CH4127","type":"Theory","room":"108"},
      {"id":"mon-1045-es3103-theory-101","day":"Monday","time":"10:45","minutes":645,"duration":50,"course":"ES3103","type":"Theory","room":"101"},
      {"id":"mon-1045-ls2103-theory-s-n-bose-lecture-theatre","day":"Monday","time":"10:45","minutes":645,"duration":50,"course":"LS2103","type":"Theory","room":"S N Bose Lecture Theatre"},
      {"id":"mon-1045-ls3102-theory-102","day":"Monday","time":"10:45","minutes":645,"duration":50,"course":"LS3102","type":"Theory","room":"102"},
      {"id":"mon-1045-ma3104-theory-g09","day":"Monday","time":"10:45","minutes":645,"duration":50,"course":"MA3104","type":"Theory","room":"G09"},
      {"id":"mon-1045-ma5102-theory-211","day":"Monday","time":"10:45","minutes":645,"duration":50,"course":"MA5102","type":"Theory","room":"211"},
      {"id":"mon-1045-ph4102-theory-d-n-wadia-lecture-theatre","day":"Monday","time":"10:45","minutes":645,"duration":50,"course":"PH4102","type":"Theory","room":"D N Wadia Lecture Theatre"},
      {"id":"mon-1045-ph5113-theory-111","day":"Monday","time":"10:45","minutes":645,"duration":50,"course":"PH5113","type":"Theory","room":"111"},
      {"id":"mon-1140-ch3103-theory-g02","day":"Monday","time":"11:40","minutes":700,"duration":50,"course":"CH3103","type":"Theory","room":"G02"},
      {"id":"mon-1140-ch4120-theory-111","day":"Monday","time":"11:40","minutes":700,"duration":50,"course":"CH4120","type":"Theory","room":"111"},
      {"id":"mon-1140-es3108-theory-101","day":"Monday","time":"11:40","minutes":700,"duration":50,"course":"ES3108","type":"Theory","room":"101"},
      {"id":"mon-1140-ls4109-theory-g09","day":"Monday","time":"11:40","minutes":700,"duration":50,"course":"LS4109","type":"Theory","room":"G09"},
      {"id":"mon-1140-ls5103-theory-108","day":"Monday","time":"11:40","minutes":700,"duration":50,"course":"LS5103","type":"Theory","room":"108"},
      {"id":"mon-1140-ma5122-theory-211","day":"Monday","time":"11:40","minutes":700,"duration":50,"course":"MA5122","type":"Theory","room":"211"},
      {"id":"mon-1140-ph2104-theory-s-n-bose-lecture-theatre","day":"Monday","time":"11:40","minutes":700,"duration":50,"course":"PH2104","type":"Theory","room":"S N Bose Lecture Theatre"},
      {"id":"mon-1140-ph4104-theory-102","day":"Monday","time":"11:40","minutes":700,"duration":50,"course":"PH4104","type":"Theory","room":"102"},
      {"id":"mon-1140-ph5103-theory-112","day":"Monday","time":"11:40","minutes":700,"duration":50,"course":"PH5103","type":"Theory","room":"112"},
      {"id":"mon-1330-ch2103-lab-dcs-2nd-year-lab","day":"Monday","time":"13:30","minutes":810,"duration":160,"course":"CH2103","type":"Lab","room":"DCS 2nd Year Lab"},
      {"id":"mon-1330-ch4114-theory-209","day":"Monday","time":"13:30","minutes":810,"duration":50,"course":"CH4114","type":"Theory","room":"209"},
      {"id":"mon-1330-ch4117-theory-108","day":"Monday","time":"13:30","minutes":810,"duration":50,"course":"CH4117","type":"Theory","room":"108"},
      {"id":"mon-1330-ch5104-theory-212","day":"Monday","time":"13:30","minutes":810,"duration":50,"course":"CH5104","type":"Theory","room":"212"},
      {"id":"mon-1330-es2105-lab-des-2nd-year-lab","day":"Monday","time":"13:30","minutes":810,"duration":160,"course":"ES2105","type":"Lab","room":"DES 2nd Year Lab"},
      {"id":"mon-1330-es3105-theory-101","day":"Monday","time":"13:30","minutes":810,"duration":50,"course":"ES3105","type":"Theory","room":"101"},
      {"id":"mon-1330-es4103-theory-112","day":"Monday","time":"13:30","minutes":810,"duration":50,"course":"ES4103","type":"Theory","room":"112"},
      {"id":"mon-1330-ls2102-lab-dbs-2nd-year-lab","day":"Monday","time":"13:30","minutes":810,"duration":160,"course":"LS2102","type":"Lab","room":"DBS 2nd Year Lab"},
      {"id":"mon-1330-ls3103-theory-103","day":"Monday","time":"13:30","minutes":810,"duration":50,"course":"LS3103","type":"Theory","room":"103"},
      {"id":"mon-1330-ls4115-theory-111","day":"Monday","time":"13:30","minutes":810,"duration":50,"course":"LS4115","type":"Theory","room":"111"},
      {"id":"mon-1330-ma3110-theory-g09","day":"Monday","time":"13:30","minutes":810,"duration":50,"course":"MA3110","type":"Theory","room":"G09"},
      {"id":"mon-1330-ma4107-theory-211","day":"Monday","time":"13:30","minutes":810,"duration":50,"course":"MA4107","type":"Theory","room":"211"},
      {"id":"mon-1330-ph2103-lab-dps-2nd-year-lab","day":"Monday","time":"13:30","minutes":810,"duration":160,"course":"PH2103","type":"Lab","room":"DPS 2nd Year Lab"},
      {"id":"mon-1425-ch4111-theory-g09","day":"Monday","time":"14:25","minutes":865,"duration":50,"course":"CH4111","type":"Theory","room":"G09"},
      {"id":"mon-1425-ch4125-theory-108","day":"Monday","time":"14:25","minutes":865,"duration":50,"course":"CH4125","type":"Theory","room":"108"},
      {"id":"mon-1425-ch5103-theory-201","day":"Monday","time":"14:25","minutes":865,"duration":50,"course":"CH5103","type":"Theory","room":"201"},
      {"id":"mon-1425-es4107-theory-111","day":"Monday","time":"14:25","minutes":865,"duration":50,"course":"ES4107","type":"Theory","room":"111"},
      {"id":"mon-1425-ls4107-theory-102","day":"Monday","time":"14:25","minutes":865,"duration":50,"course":"LS4107","type":"Theory","room":"102"},
      {"id":"mon-1425-ls4112-theory-112","day":"Monday","time":"14:25","minutes":865,"duration":50,"course":"LS4112","type":"Theory","room":"112"},
      {"id":"mon-1425-ma4104-theory-211","day":"Monday","time":"14:25","minutes":865,"duration":50,"course":"MA4104","type":"Theory","room":"211"},
      {"id":"mon-1425-ph3103-theory-g02","day":"Monday","time":"14:25","minutes":865,"duration":50,"course":"PH3103","type":"Theory","room":"G02"},
      {"id":"mon-1425-ph4108-theory-101","day":"Monday","time":"14:25","minutes":865,"duration":50,"course":"PH4108","type":"Theory","room":"101"},
      {"id":"mon-1520-cs2102-theory-ramanujan-virtual-classroom","day":"Monday","time":"15:20","minutes":920,"duration":50,"course":"CS2102","type":"Theory","room":"Ramanujan Virtual Classroom"},
      {"id":"mon-1520-cs3102-theory-g09","day":"Monday","time":"15:20","minutes":920,"duration":50,"course":"CS3102","type":"Theory","room":"G09"},
      {"id":"mon-1520-ph4108-tutorial-101","day":"Monday","time":"15:20","minutes":920,"duration":50,"course":"PH4108","type":"Tutorial","room":"101"},
      {"id":"mon-1615-ch2102-theory-s-n-bose-lecture-theatre","day":"Monday","time":"16:15","minutes":975,"duration":50,"course":"CH2102","type":"Theory","room":"S N Bose Lecture Theatre"},
      {"id":"mon-1615-ch3104-theory-g02","day":"Monday","time":"16:15","minutes":975,"duration":50,"course":"CH3104","type":"Theory","room":"G02"},
      {"id":"mon-1615-ch4105-theory-101","day":"Monday","time":"16:15","minutes":975,"duration":50,"course":"CH4105","type":"Theory","room":"101"},
      {"id":"mon-1615-ch4109-theory-112","day":"Monday","time":"16:15","minutes":975,"duration":50,"course":"CH4109","type":"Theory","room":"112"},
      {"id":"mon-1615-ch4122-theory-108","day":"Monday","time":"16:15","minutes":975,"duration":50,"course":"CH4122","type":"Theory","room":"108"},
      {"id":"mon-1615-ls4102-theory-102","day":"Monday","time":"16:15","minutes":975,"duration":50,"course":"LS4102","type":"Theory","room":"102"},
      {"id":"mon-1615-ls4113-theory-111","day":"Monday","time":"16:15","minutes":975,"duration":50,"course":"LS4113","type":"Theory","room":"111"},
      {"id":"mon-1615-ma3108-theory-g09","day":"Monday","time":"16:15","minutes":975,"duration":50,"course":"MA3108","type":"Theory","room":"G09"},
      {"id":"mon-1615-ma5125-theory-211","day":"Monday","time":"16:15","minutes":975,"duration":50,"course":"MA5125","type":"Theory","room":"211"},
      {"id":"mon-1615-ph4113-theory-g08","day":"Monday","time":"16:15","minutes":975,"duration":50,"course":"PH4113","type":"Theory","room":"G08"},
      {"id":"mon-1710-ch3104-tutorial-g02","day":"Monday","time":"17:10","minutes":1030,"duration":50,"course":"CH3104","type":"Tutorial","room":"G02"},
      {"id":"mon-1710-ch4105-tutorial-101","day":"Monday","time":"17:10","minutes":1030,"duration":50,"course":"CH4105","type":"Tutorial","room":"101"},
      {"id":"mon-1710-ch4109-tutorial-112","day":"Monday","time":"17:10","minutes":1030,"duration":50,"course":"CH4109","type":"Tutorial","room":"112"},
      {"id":"mon-1710-ch4122-tutorial-108","day":"Monday","time":"17:10","minutes":1030,"duration":50,"course":"CH4122","type":"Tutorial","room":"108"},
      {"id":"mon-1710-ls4102-tutorial-102","day":"Monday","time":"17:10","minutes":1030,"duration":50,"course":"LS4102","type":"Tutorial","room":"102"},
      {"id":"mon-1710-ls4113-tutorial-111","day":"Monday","time":"17:10","minutes":1030,"duration":50,"course":"LS4113","type":"Tutorial","room":"111"},
      {"id":"mon-1710-ma3108-tutorial-g09","day":"Monday","time":"17:10","minutes":1030,"duration":50,"course":"MA3108","type":"Tutorial","room":"G09"},
      {"id":"mon-1710-ma5125-tutorial-211","day":"Monday","time":"17:10","minutes":1030,"duration":50,"course":"MA5125","type":"Tutorial","room":"211"},
      {"id":"mon-1710-ph2101-tutorial-s-n-bose-lecture-theatre","day":"Monday","time":"17:10","minutes":1030,"duration":50,"course":"PH2101","type":"Tutorial","room":"S N Bose Lecture Theatre"},
      {"id":"mon-1710-ph4113-tutorial-g08","day":"Monday","time":"17:10","minutes":1030,"duration":50,"course":"PH4113","type":"Tutorial","room":"G08"},
      {"id":"tue-0800-ch2105-tutorial-s-n-bose-lecture-theatre","day":"Tuesday","time":"08:00","minutes":480,"duration":50,"course":"CH2105","type":"Tutorial","room":"S N Bose Lecture Theatre"},
      {"id":"tue-0800-ch4106-tutorial-101","day":"Tuesday","time":"08:00","minutes":480,"duration":50,"course":"CH4106","type":"Tutorial","room":"101"},
      {"id":"tue-0800-ls3101-tutorial-102","day":"Tuesday","time":"08:00","minutes":480,"duration":50,"course":"LS3101","type":"Tutorial","room":"102"},
      {"id":"tue-0800-ls4106-tutorial-111","day":"Tuesday","time":"08:00","minutes":480,"duration":50,"course":"LS4106","type":"Tutorial","room":"111"},
      {"id":"tue-0800-ma3109-tutorial-g09","day":"Tuesday","time":"08:00","minutes":480,"duration":50,"course":"MA3109","type":"Tutorial","room":"G09"},
      {"id":"tue-0800-ma4112-tutorial-209","day":"Tuesday","time":"08:00","minutes":480,"duration":50,"course":"MA4112","type":"Tutorial","room":"209"},
      {"id":"tue-0800-ph3102-tutorial-g02","day":"Tuesday","time":"08:00","minutes":480,"duration":50,"course":"PH3102","type":"Tutorial","room":"G02"},
      {"id":"tue-0800-ph4106-tutorial-103","day":"Tuesday","time":"08:00","minutes":480,"duration":50,"course":"PH4106","type":"Tutorial","room":"103"},
      {"id":"tue-0855-ch4106-theory-101","day":"Tuesday","time":"08:55","minutes":535,"duration":50,"course":"CH4106","type":"Theory","room":"101"},
      {"id":"tue-0855-es2103-theory-ramanujan-virtual-classroom","day":"Tuesday","time":"08:55","minutes":535,"duration":50,"course":"ES2103","type":"Theory","room":"Ramanujan Virtual Classroom"},
      {"id":"tue-0855-ls3101-theory-102","day":"Tuesday","time":"08:55","minutes":535,"duration":50,"course":"LS3101","type":"Theory","room":"102"},
      {"id":"tue-0855-ls4106-theory-111","day":"Tuesday","time":"08:55","minutes":535,"duration":50,"course":"LS4106","type":"Theory","room":"111"},
      {"id":"tue-0855-ls5101-theory-108","day":"Tuesday","time":"08:55","minutes":535,"duration":50,"course":"LS5101","type":"Theory","room":"108"},
      {"id":"tue-0855-ma3109-theory-g09","day":"Tuesday","time":"08:55","minutes":535,"duration":50,"course":"MA3109","type":"Theory","room":"G09"},
      {"id":"tue-0855-ma4112-theory-209","day":"Tuesday","time":"08:55","minutes":535,"duration":50,"course":"MA4112","type":"Theory","room":"209"},
      {"id":"tue-0855-ma5126-theory-211","day":"Tuesday","time":"08:55","minutes":535,"duration":50,"course":"MA5126","type":"Theory","room":"211"},
      {"id":"tue-0855-ph3102-theory-g02","day":"Tuesday","time":"08:55","minutes":535,"duration":50,"course":"PH3102","type":"Theory","room":"G02"},
      {"id":"tue-0855-ph4106-theory-103","day":"Tuesday","time":"08:55","minutes":535,"duration":50,"course":"PH4106","type":"Theory","room":"103"},
      {"id":"tue-0950-ch4104-theory-110","day":"Tuesday","time":"09:50","minutes":590,"duration":50,"course":"CH4104","type":"Theory","room":"110"},
      {"id":"tue-0950-ch4127-theory-108","day":"Tuesday","time":"09:50","minutes":590,"duration":50,"course":"CH4127","type":"Theory","room":"108"},
      {"id":"tue-0950-es3103-theory-101","day":"Tuesday","time":"09:50","minutes":590,"duration":50,"course":"ES3103","type":"Theory","room":"101"},
      {"id":"tue-0950-ls3102-theory-102","day":"Tuesday","time":"09:50","minutes":590,"duration":50,"course":"LS3102","type":"Theory","room":"102"},
      {"id":"tue-0950-ma2101-theory-ramanujan-virtual-classroom","day":"Tuesday","time":"09:50","minutes":590,"duration":50,"course":"MA2101","type":"Theory","room":"Ramanujan Virtual Classroom"},
      {"id":"tue-0950-ma3104-theory-g09","day":"Tuesday","time":"09:50","minutes":590,"duration":50,"course":"MA3104","type":"Theory","room":"G09"},
      {"id":"tue-0950-ma5102-theory-211","day":"Tuesday","time":"09:50","minutes":590,"duration":50,"course":"MA5102","type":"Theory","room":"211"},
      {"id":"tue-0950-ph4102-theory-d-n-wadia-lecture-theatre","day":"Tuesday","time":"09:50","minutes":590,"duration":50,"course":"PH4102","type":"Theory","room":"D N Wadia Lecture Theatre"},
      {"id":"tue-0950-ph5113-theory-111","day":"Tuesday","time":"09:50","minutes":590,"duration":50,"course":"PH5113","type":"Theory","room":"111"},
      {"id":"tue-1045-ch4121-theory-103","day":"Tuesday","time":"10:45","minutes":645,"duration":50,"course":"CH4121","type":"Theory","room":"103"},
      {"id":"tue-1045-ch4126-theory-201","day":"Tuesday","time":"10:45","minutes":645,"duration":50,"course":"CH4126","type":"Theory","room":"201"},
      {"id":"tue-1045-es3101-theory-101","day":"Tuesday","time":"10:45","minutes":645,"duration":50,"course":"ES3101","type":"Theory","room":"101"},
      {"id":"tue-1045-es4108-theory-108","day":"Tuesday","time":"10:45","minutes":645,"duration":50,"course":"ES4108","type":"Theory","room":"108"},
      {"id":"tue-1045-ls2101-theory-s-n-bose-lecture-theatre","day":"Tuesday","time":"10:45","minutes":645,"duration":50,"course":"LS2101","type":"Theory","room":"S N Bose Lecture Theatre"},
      {"id":"tue-1045-ls4101-theory-102","day":"Tuesday","time":"10:45","minutes":645,"duration":50,"course":"LS4101","type":"Theory","room":"102"},
      {"id":"tue-1045-ma4102-theory-g09","day":"Tuesday","time":"10:45","minutes":645,"duration":50,"course":"MA4102","type":"Theory","room":"G09"},
      {"id":"tue-1045-ph3101-theory-g02","day":"Tuesday","time":"10:45","minutes":645,"duration":50,"course":"PH3101","type":"Theory","room":"G02"},
      {"id":"tue-1045-ph4107-theory-112","day":"Tuesday","time":"10:45","minutes":645,"duration":50,"course":"PH4107","type":"Theory","room":"112"},
      {"id":"tue-1140-ch3102-theory-g02","day":"Tuesday","time":"11:40","minutes":700,"duration":50,"course":"CH3102","type":"Theory","room":"G02"},
      {"id":"tue-1140-ch4107-theory-102","day":"Tuesday","time":"11:40","minutes":700,"duration":50,"course":"CH4107","type":"Theory","room":"102"},
      {"id":"tue-1140-ch4128-theory-101","day":"Tuesday","time":"11:40","minutes":700,"duration":50,"course":"CH4128","type":"Theory","room":"101"},
      {"id":"tue-1140-cs2103-theory-201","day":"Tuesday","time":"11:40","minutes":700,"duration":50,"course":"CS2103","type":"Theory","room":"201"},
      {"id":"tue-1140-es2104-theory-ramanujan-virtual-classroom","day":"Tuesday","time":"11:40","minutes":700,"duration":50,"course":"ES2104","type":"Theory","room":"Ramanujan Virtual Classroom"},
      {"id":"tue-1140-es4105-theory-108","day":"Tuesday","time":"11:40","minutes":700,"duration":50,"course":"ES4105","type":"Theory","room":"108"},
      {"id":"tue-1140-ma4101-theory-g09","day":"Tuesday","time":"11:40","minutes":700,"duration":50,"course":"MA4101","type":"Theory","room":"G09"},
      {"id":"tue-1140-ma4106-theory-211","day":"Tuesday","time":"11:40","minutes":700,"duration":50,"course":"MA4106","type":"Theory","room":"211"},
      {"id":"tue-1140-ph3104-theory-g08","day":"Tuesday","time":"11:40","minutes":700,"duration":50,"course":"PH3104","type":"Theory","room":"G08"},
      {"id":"tue-1140-ph4101-theory-110","day":"Tuesday","time":"11:40","minutes":700,"duration":50,"course":"PH4101","type":"Theory","room":"110"},
      {"id":"tue-1330-ch3105-lab-dcs-3rd-year-lab-1","day":"Tuesday","time":"13:30","minutes":810,"duration":160,"course":"CH3105","type":"Lab","room":"DCS 3rd Year Lab 1"},
      {"id":"tue-1330-ch4118-lab-dcs-4th-year-lab","day":"Tuesday","time":"13:30","minutes":810,"duration":160,"course":"CH4118","type":"Lab","room":"DCS 4th Year Lab"},
      {"id":"tue-1330-ch4123-lab-dcs-4th-year-lab-1","day":"Tuesday","time":"13:30","minutes":810,"duration":160,"course":"CH4123","type":"Lab","room":"DCS 4th Year Lab 1"},
      {"id":"tue-1330-ch4124-lab-dcs-4th-year-lab-2","day":"Tuesday","time":"13:30","minutes":810,"duration":160,"course":"CH4124","type":"Lab","room":"DCS 4th Year Lab 2"},
      {"id":"tue-1330-cs2101-theory-ramanujan-virtual-classroom","day":"Tuesday","time":"13:30","minutes":810,"duration":50,"course":"CS2101","type":"Theory","room":"Ramanujan Virtual Classroom"},
      {"id":"tue-1330-es3102-lab-des-3rd-year-lab","day":"Tuesday","time":"13:30","minutes":810,"duration":160,"course":"ES3102","type":"Lab","room":"DES 3rd Year Lab"},
      {"id":"tue-1330-es3104-lab-des-3rd-year-lab-1","day":"Tuesday","time":"13:30","minutes":810,"duration":160,"course":"ES3104","type":"Lab","room":"DES 3rd Year Lab 1"},
      {"id":"tue-1330-es4102-lab-des-4th-year-lab","day":"Tuesday","time":"13:30","minutes":810,"duration":160,"course":"ES4102","type":"Lab","room":"DES 4th Year Lab"},
      {"id":"tue-1330-es4104-lab-des-4th-year-lab-1","day":"Tuesday","time":"13:30","minutes":810,"duration":160,"course":"ES4104","type":"Lab","room":"DES 4th Year Lab 1"},
      {"id":"tue-1330-es4106-lab-des-4th-year-lab-2","day":"Tuesday","time":"13:30","minutes":810,"duration":160,"course":"ES4106","type":"Lab","room":"DES 4th Year Lab 2"},
      {"id":"tue-1330-ls3104-lab-dbs-3rd-year-lab","day":"Tuesday","time":"13:30","minutes":810,"duration":160,"course":"LS3104","type":"Lab","room":"DBS 3rd Year Lab"},
      {"id":"tue-1330-ls3105-lab-dbs-3rd-year-lab-1","day":"Tuesday","time":"13:30","minutes":810,"duration":160,"course":"LS3105","type":"Lab","room":"DBS 3rd Year Lab 1"},
      {"id":"tue-1330-ls3106-lab-dbs-3rd-year-lab-2","day":"Tuesday","time":"13:30","minutes":810,"duration":160,"course":"LS3106","type":"Lab","room":"DBS 3rd Year Lab 2"},
      {"id":"tue-1330-ls4104-lab-dbs-4th-year-lab","day":"Tuesday","time":"13:30","minutes":810,"duration":160,"course":"LS4104","type":"Lab","room":"DBS 4th Year Lab"},
      {"id":"tue-1330-ls4114-lab-dbs-4th-year-lab-1","day":"Tuesday","time":"13:30","minutes":810,"duration":160,"course":"LS4114","type":"Lab","room":"DBS 4th Year Lab 1"},
      {"id":"tue-1330-ma4111-lab-dms-4th-year-lab","day":"Tuesday","time":"13:30","minutes":810,"duration":160,"course":"MA4111","type":"Lab","room":"DMS 4th Year Lab"},
      {"id":"tue-1330-ph3105-lab-dps-3rd-year-lab","day":"Tuesday","time":"13:30","minutes":810,"duration":160,"course":"PH3105","type":"Lab","room":"DPS 3rd Year Lab"},
      {"id":"tue-1330-ph4103-lab-dps-4th-year-lab","day":"Tuesday","time":"13:30","minutes":810,"duration":160,"course":"PH4103","type":"Lab","room":"DPS 4th Year Lab"},
      {"id":"tue-1425-ch2104-theory-s-n-bose-lecture-theatre","day":"Tuesday","time":"14:25","minutes":865,"duration":50,"course":"CH2104","type":"Theory","room":"S N Bose Lecture Theatre"},
      {"id":"tue-1615-ch3106-theory-102","day":"Tuesday","time":"16:15","minutes":975,"duration":50,"course":"CH3106","type":"Theory","room":"102"},
      {"id":"tue-1615-ch4115-theory-g09","day":"Tuesday","time":"16:15","minutes":975,"duration":50,"course":"CH4115","type":"Theory","room":"G09"},
      {"id":"tue-1615-ch4116-theory-101","day":"Tuesday","time":"16:15","minutes":975,"duration":50,"course":"CH4116","type":"Theory","room":"101"},
      {"id":"tue-1615-cs4103-theory-g02","day":"Tuesday","time":"16:15","minutes":975,"duration":50,"course":"CS4103","type":"Theory","room":"G02"},
      {"id":"tue-1615-hu4102-theory-111","day":"Tuesday","time":"16:15","minutes":975,"duration":50,"course":"HU4102","type":"Theory","room":"111"},
      {"id":"tue-1615-hu4103-theory-108","day":"Tuesday","time":"16:15","minutes":975,"duration":50,"course":"HU4103","type":"Theory","room":"108"},
      {"id":"tue-1615-ls4105-theory-112","day":"Tuesday","time":"16:15","minutes":975,"duration":50,"course":"LS4105","type":"Theory","room":"112"},
      {"id":"tue-1615-ma2104-tutorial-d-n-wadia-lecture-theatre","day":"Tuesday","time":"16:15","minutes":975,"duration":50,"course":"MA2104","type":"Tutorial","room":"D N Wadia Lecture Theatre"},
      {"id":"tue-1615-ma3103-theory-211","day":"Tuesday","time":"16:15","minutes":975,"duration":50,"course":"MA3103","type":"Theory","room":"211"},
      {"id":"tue-1615-ph5114-theory-201","day":"Tuesday","time":"16:15","minutes":975,"duration":50,"course":"PH5114","type":"Theory","room":"201"},
      {"id":"tue-1710-ch3106-tutorial-102","day":"Tuesday","time":"17:10","minutes":1030,"duration":50,"course":"CH3106","type":"Tutorial","room":"102"},
      {"id":"tue-1710-ch4115-tutorial-g09","day":"Tuesday","time":"17:10","minutes":1030,"duration":50,"course":"CH4115","type":"Tutorial","room":"G09"},
      {"id":"tue-1710-ch4116-tutorial-101","day":"Tuesday","time":"17:10","minutes":1030,"duration":50,"course":"CH4116","type":"Tutorial","room":"101"},
      {"id":"tue-1710-cs4103-tutorial-g02","day":"Tuesday","time":"17:10","minutes":1030,"duration":50,"course":"CS4103","type":"Tutorial","room":"G02"},
      {"id":"tue-1710-es2103-tutorial-d-n-wadia-lecture-theatre","day":"Tuesday","time":"17:10","minutes":1030,"duration":50,"course":"ES2103","type":"Tutorial","room":"D N Wadia Lecture Theatre"},
      {"id":"tue-1710-hu4102-tutorial-111","day":"Tuesday","time":"17:10","minutes":1030,"duration":50,"course":"HU4102","type":"Tutorial","room":"111"},
      {"id":"tue-1710-hu4103-tutorial-108","day":"Tuesday","time":"17:10","minutes":1030,"duration":50,"course":"HU4103","type":"Tutorial","room":"108"},
      {"id":"tue-1710-ls4105-tutorial-112","day":"Tuesday","time":"17:10","minutes":1030,"duration":50,"course":"LS4105","type":"Tutorial","room":"112"},
      {"id":"tue-1710-ma3103-tutorial-211","day":"Tuesday","time":"17:10","minutes":1030,"duration":50,"course":"MA3103","type":"Tutorial","room":"211"},
      {"id":"tue-1710-ph5114-tutorial-201","day":"Tuesday","time":"17:10","minutes":1030,"duration":50,"course":"PH5114","type":"Tutorial","room":"201"},
      {"id":"wed-0800-ch4114-tutorial-209","day":"Wednesday","time":"08:00","minutes":480,"duration":50,"course":"CH4114","type":"Tutorial","room":"209"},
      {"id":"wed-0800-ch4117-tutorial-108","day":"Wednesday","time":"08:00","minutes":480,"duration":50,"course":"CH4117","type":"Tutorial","room":"108"},
      {"id":"wed-0800-ch5104-tutorial-212","day":"Wednesday","time":"08:00","minutes":480,"duration":50,"course":"CH5104","type":"Tutorial","room":"212"},
      {"id":"wed-0800-es3105-tutorial-101","day":"Wednesday","time":"08:00","minutes":480,"duration":50,"course":"ES3105","type":"Tutorial","room":"101"},
      {"id":"wed-0800-es4103-tutorial-112","day":"Wednesday","time":"08:00","minutes":480,"duration":50,"course":"ES4103","type":"Tutorial","room":"112"},
      {"id":"wed-0800-ls3103-tutorial-103","day":"Wednesday","time":"08:00","minutes":480,"duration":50,"course":"LS3103","type":"Tutorial","room":"103"},
      {"id":"wed-0800-ls4115-tutorial-111","day":"Wednesday","time":"08:00","minutes":480,"duration":50,"course":"LS4115","type":"Tutorial","room":"111"},
      {"id":"wed-0800-ma3110-tutorial-g09","day":"Wednesday","time":"08:00","minutes":480,"duration":50,"course":"MA3110","type":"Tutorial","room":"G09"},
      {"id":"wed-0800-ma4107-tutorial-211","day":"Wednesday","time":"08:00","minutes":480,"duration":50,"course":"MA4107","type":"Tutorial","room":"211"},
      {"id":"wed-0800-ph2104-tutorial-s-n-bose-lecture-theatre","day":"Wednesday","time":"08:00","minutes":480,"duration":50,"course":"PH2104","type":"Tutorial","room":"S N Bose Lecture Theatre"},
      {"id":"wed-0855-ch4114-theory-209","day":"Wednesday","time":"08:55","minutes":535,"duration":50,"course":"CH4114","type":"Theory","room":"209"},
      {"id":"wed-0855-ch4117-theory-108","day":"Wednesday","time":"08:55","minutes":535,"duration":50,"course":"CH4117","type":"Theory","room":"108"},
      {"id":"wed-0855-ch5104-theory-212","day":"Wednesday","time":"08:55","minutes":535,"duration":50,"course":"CH5104","type":"Theory","room":"212"},
      {"id":"wed-0855-es3105-theory-101","day":"Wednesday","time":"08:55","minutes":535,"duration":50,"course":"ES3105","type":"Theory","room":"101"},
      {"id":"wed-0855-es4103-theory-112","day":"Wednesday","time":"08:55","minutes":535,"duration":50,"course":"ES4103","type":"Theory","room":"112"},
      {"id":"wed-0855-ls3103-theory-103","day":"Wednesday","time":"08:55","minutes":535,"duration":50,"course":"LS3103","type":"Theory","room":"103"},
      {"id":"wed-0855-ls4115-theory-111","day":"Wednesday","time":"08:55","minutes":535,"duration":50,"course":"LS4115","type":"Theory","room":"111"},
      {"id":"wed-0855-ma2104-theory-ramanujan-virtual-classroom","day":"Wednesday","time":"08:55","minutes":535,"duration":50,"course":"MA2104","type":"Theory","room":"Ramanujan Virtual Classroom"},
      {"id":"wed-0855-ma3110-theory-g09","day":"Wednesday","time":"08:55","minutes":535,"duration":50,"course":"MA3110","type":"Theory","room":"G09"},
      {"id":"wed-0855-ma4107-theory-211","day":"Wednesday","time":"08:55","minutes":535,"duration":50,"course":"MA4107","type":"Theory","room":"211"},
      {"id":"wed-0950-ch4111-theory-g09","day":"Wednesday","time":"09:50","minutes":590,"duration":50,"course":"CH4111","type":"Theory","room":"G09"},
      {"id":"wed-0950-ch4125-theory-108","day":"Wednesday","time":"09:50","minutes":590,"duration":50,"course":"CH4125","type":"Theory","room":"108"},
      {"id":"wed-0950-ch5103-theory-201","day":"Wednesday","time":"09:50","minutes":590,"duration":50,"course":"CH5103","type":"Theory","room":"201"},
      {"id":"wed-0950-cs2101-theory-ramanujan-virtual-classroom","day":"Wednesday","time":"09:50","minutes":590,"duration":50,"course":"CS2101","type":"Theory","room":"Ramanujan Virtual Classroom"},
      {"id":"wed-0950-es4107-theory-111","day":"Wednesday","time":"09:50","minutes":590,"duration":50,"course":"ES4107","type":"Theory","room":"111"},
      {"id":"wed-0950-ls4107-theory-102","day":"Wednesday","time":"09:50","minutes":590,"duration":50,"course":"LS4107","type":"Theory","room":"102"},
      {"id":"wed-0950-ls4112-theory-112","day":"Wednesday","time":"09:50","minutes":590,"duration":50,"course":"LS4112","type":"Theory","room":"112"},
      {"id":"wed-0950-ma4104-theory-211","day":"Wednesday","time":"09:50","minutes":590,"duration":50,"course":"MA4104","type":"Theory","room":"211"},
      {"id":"wed-0950-ph3103-theory-g02","day":"Wednesday","time":"09:50","minutes":590,"duration":50,"course":"PH3103","type":"Theory","room":"G02"},
      {"id":"wed-0950-ph4108-theory-101","day":"Wednesday","time":"09:50","minutes":590,"duration":50,"course":"PH4108","type":"Theory","room":"101"},
      {"id":"wed-1045-ch3101-theory-g08","day":"Wednesday","time":"10:45","minutes":645,"duration":50,"course":"CH3101","type":"Theory","room":"G08"},
      {"id":"wed-1045-ch4102-theory-102","day":"Wednesday","time":"10:45","minutes":645,"duration":50,"course":"CH4102","type":"Theory","room":"102"},
      {"id":"wed-1045-ch5102-theory-201","day":"Wednesday","time":"10:45","minutes":645,"duration":50,"course":"CH5102","type":"Theory","room":"201"},
      {"id":"wed-1045-es4101-theory-101","day":"Wednesday","time":"10:45","minutes":645,"duration":50,"course":"ES4101","type":"Theory","room":"101"},
      {"id":"wed-1045-ls2103-theory-s-n-bose-lecture-theatre","day":"Wednesday","time":"10:45","minutes":645,"duration":50,"course":"LS2103","type":"Theory","room":"S N Bose Lecture Theatre"},
      {"id":"wed-1045-ls4103-theory-103","day":"Wednesday","time":"10:45","minutes":645,"duration":50,"course":"LS4103","type":"Theory","room":"103"},
      {"id":"wed-1045-ma3101-theory-g09","day":"Wednesday","time":"10:45","minutes":645,"duration":50,"course":"MA3101","type":"Theory","room":"G09"},
      {"id":"wed-1045-ma4110-theory-211","day":"Wednesday","time":"10:45","minutes":645,"duration":50,"course":"MA4110","type":"Theory","room":"211"},
      {"id":"wed-1045-ph4110-theory-112","day":"Wednesday","time":"10:45","minutes":645,"duration":50,"course":"PH4110","type":"Theory","room":"112"},
      {"id":"wed-1140-ch2105-theory-s-n-bose-lecture-theatre","day":"Wednesday","time":"11:40","minutes":700,"duration":50,"course":"CH2105","type":"Theory","room":"S N Bose Lecture Theatre"},
      {"id":"wed-1140-ch3104-theory-g02","day":"Wednesday","time":"11:40","minutes":700,"duration":50,"course":"CH3104","type":"Theory","room":"G02"},
      {"id":"wed-1140-ch4105-theory-101","day":"Wednesday","time":"11:40","minutes":700,"duration":50,"course":"CH4105","type":"Theory","room":"101"},
      {"id":"wed-1140-ch4122-theory-108","day":"Wednesday","time":"11:40","minutes":700,"duration":50,"course":"CH4122","type":"Theory","room":"108"},
      {"id":"wed-1140-ls4102-theory-102","day":"Wednesday","time":"11:40","minutes":700,"duration":50,"course":"LS4102","type":"Theory","room":"102"},
      {"id":"wed-1140-ls4113-theory-111","day":"Wednesday","time":"11:40","minutes":700,"duration":50,"course":"LS4113","type":"Theory","room":"111"},
      {"id":"wed-1140-ma3108-theory-g09","day":"Wednesday","time":"11:40","minutes":700,"duration":50,"course":"MA3108","type":"Theory","room":"G09"},
      {"id":"wed-1140-ma5125-theory-211","day":"Wednesday","time":"11:40","minutes":700,"duration":50,"course":"MA5125","type":"Theory","room":"211"},
      {"id":"wed-1140-ph4113-theory-g08","day":"Wednesday","time":"11:40","minutes":700,"duration":50,"course":"PH4113","type":"Theory","room":"G08"},
      {"id":"wed-1330-ch2103-lab-dcs-2nd-year-lab","day":"Wednesday","time":"13:30","minutes":810,"duration":160,"course":"CH2103","type":"Lab","room":"DCS 2nd Year Lab"},
      {"id":"wed-1330-cs2102-theory-ramanujan-virtual-classroom","day":"Wednesday","time":"13:30","minutes":810,"duration":160,"course":"CS2102","type":"Theory","room":"Ramanujan Virtual Classroom"},
      {"id":"wed-1330-cs3102-lab-computer-lab-2","day":"Wednesday","time":"13:30","minutes":810,"duration":160,"course":"CS3102","type":"Lab","room":"Computer Lab 2"},
      {"id":"wed-1330-es2105-lab-des-2nd-year-lab","day":"Wednesday","time":"13:30","minutes":810,"duration":160,"course":"ES2105","type":"Lab","room":"DES 2nd Year Lab"},
      {"id":"wed-1330-ls2102-lab-dbs-2nd-year-lab","day":"Wednesday","time":"13:30","minutes":810,"duration":160,"course":"LS2102","type":"Lab","room":"DBS 2nd Year Lab"},
      {"id":"wed-1330-ph2103-lab-dps-2nd-year-lab","day":"Wednesday","time":"13:30","minutes":810,"duration":160,"course":"PH2103","type":"Lab","room":"DPS 2nd Year Lab"},
      {"id":"wed-1330-ph3105-lab-dps-3rd-year-lab-1","day":"Wednesday","time":"13:30","minutes":810,"duration":160,"course":"PH3105","type":"Lab","room":"DPS 3rd Year Lab 1"},
      {"id":"wed-1330-ph4103-lab-dbs-4th-year-lab","day":"Wednesday","time":"13:30","minutes":810,"duration":160,"course":"PH4103","type":"Lab","room":"DBS 4th Year Lab"},
      {"id":"wed-1615-ch4121-theory-103","day":"Wednesday","time":"16:15","minutes":975,"duration":50,"course":"CH4121","type":"Theory","room":"103"},
      {"id":"wed-1615-ch4126-theory-201","day":"Wednesday","time":"16:15","minutes":975,"duration":50,"course":"CH4126","type":"Theory","room":"201"},
      {"id":"wed-1615-es3101-theory-101","day":"Wednesday","time":"16:15","minutes":975,"duration":50,"course":"ES3101","type":"Theory","room":"101"},
      {"id":"wed-1615-es4108-theory-108","day":"Wednesday","time":"16:15","minutes":975,"duration":50,"course":"ES4108","type":"Theory","room":"108"},
      {"id":"wed-1615-ls4101-theory-102","day":"Wednesday","time":"16:15","minutes":975,"duration":50,"course":"LS4101","type":"Theory","room":"102"},
      {"id":"wed-1615-ma2102-theory-ramanujan-virtual-classroom","day":"Wednesday","time":"16:15","minutes":975,"duration":50,"course":"MA2102","type":"Theory","room":"Ramanujan Virtual Classroom"},
      {"id":"wed-1615-ma4102-theory-g09","day":"Wednesday","time":"16:15","minutes":975,"duration":50,"course":"MA4102","type":"Theory","room":"G09"},
      {"id":"wed-1615-ph3101-theory-g02","day":"Wednesday","time":"16:15","minutes":975,"duration":50,"course":"PH3101","type":"Theory","room":"G02"},
      {"id":"wed-1615-ph4107-theory-112","day":"Wednesday","time":"16:15","minutes":975,"duration":50,"course":"PH4107","type":"Theory","room":"112"},
      {"id":"wed-1710-ch4121-tutorial-103","day":"Wednesday","time":"17:10","minutes":1030,"duration":50,"course":"CH4121","type":"Tutorial","room":"103"},
      {"id":"wed-1710-ch4126-tutorial-201","day":"Wednesday","time":"17:10","minutes":1030,"duration":50,"course":"CH4126","type":"Tutorial","room":"201"},
      {"id":"wed-1710-es3101-tutorial-101","day":"Wednesday","time":"17:10","minutes":1030,"duration":50,"course":"ES3101","type":"Tutorial","room":"101"},
      {"id":"wed-1710-es4108-tutorial-108","day":"Wednesday","time":"17:10","minutes":1030,"duration":50,"course":"ES4108","type":"Tutorial","room":"108"},
      {"id":"wed-1710-ls4101-tutorial-102","day":"Wednesday","time":"17:10","minutes":1030,"duration":50,"course":"LS4101","type":"Tutorial","room":"102"},
      {"id":"wed-1710-ma4102-tutorial-g09","day":"Wednesday","time":"17:10","minutes":1030,"duration":50,"course":"MA4102","type":"Tutorial","room":"G09"},
      {"id":"wed-1710-ph3101-tutorial-g02","day":"Wednesday","time":"17:10","minutes":1030,"duration":50,"course":"PH3101","type":"Tutorial","room":"G02"},
      {"id":"wed-1710-ph4107-tutorial-112","day":"Wednesday","time":"17:10","minutes":1030,"duration":50,"course":"PH4107","type":"Tutorial","room":"112"},
      {"id":"thu-0800-ch2102-tutorial-s-n-bose-lecture-theatre","day":"Thursday","time":"08:00","minutes":480,"duration":50,"course":"CH2102","type":"Tutorial","room":"S N Bose Lecture Theatre"},
      {"id":"thu-0800-ch4104-tutorial-110","day":"Thursday","time":"08:00","minutes":480,"duration":50,"course":"CH4104","type":"Tutorial","room":"110"},
      {"id":"thu-0800-ch4106-tutorial-101","day":"Thursday","time":"08:00","minutes":480,"duration":50,"course":"CH4106","type":"Tutorial","room":"101"},
      {"id":"thu-0800-ch4127-tutorial-108","day":"Thursday","time":"08:00","minutes":480,"duration":50,"course":"CH4127","type":"Tutorial","room":"108"},
      {"id":"thu-0800-es3103-tutorial-101","day":"Thursday","time":"08:00","minutes":480,"duration":50,"course":"ES3103","type":"Tutorial","room":"101"},
      {"id":"thu-0800-ls3102-tutorial-102","day":"Thursday","time":"08:00","minutes":480,"duration":50,"course":"LS3102","type":"Tutorial","room":"102"},
      {"id":"thu-0800-ls4106-tutorial-111","day":"Thursday","time":"08:00","minutes":480,"duration":50,"course":"LS4106","type":"Tutorial","room":"111"},
      {"id":"thu-0800-ma3104-tutorial-g09","day":"Thursday","time":"08:00","minutes":480,"duration":50,"course":"MA3104","type":"Tutorial","room":"G09"},
      {"id":"thu-0800-ma4112-tutorial-209","day":"Thursday","time":"08:00","minutes":480,"duration":50,"course":"MA4112","type":"Tutorial","room":"209"},
      {"id":"thu-0800-ma5102-tutorial-211","day":"Thursday","time":"08:00","minutes":480,"duration":50,"course":"MA5102","type":"Tutorial","room":"211"},
      {"id":"thu-0800-ph4102-tutorial-d-n-wadia-lecture-theatre","day":"Thursday","time":"08:00","minutes":480,"duration":50,"course":"PH4102","type":"Tutorial","room":"D N Wadia Lecture Theatre"},
      {"id":"thu-0800-ph4106-tutorial-103","day":"Thursday","time":"08:00","minutes":480,"duration":50,"course":"PH4106","type":"Tutorial","room":"103"},
      {"id":"thu-0800-ph5113-tutorial-111","day":"Thursday","time":"08:00","minutes":480,"duration":50,"course":"PH5113","type":"Tutorial","room":"111"},
      {"id":"thu-0855-ch4104-theory-110","day":"Thursday","time":"08:55","minutes":535,"duration":50,"course":"CH4104","type":"Theory","room":"110"},
      {"id":"thu-0855-ch4106-theory-101","day":"Thursday","time":"08:55","minutes":535,"duration":50,"course":"CH4106","type":"Theory","room":"101"},
      {"id":"thu-0855-ch4127-theory-108","day":"Thursday","time":"08:55","minutes":535,"duration":50,"course":"CH4127","type":"Theory","room":"108"},
      {"id":"thu-0855-es3103-theory-101","day":"Thursday","time":"08:55","minutes":535,"duration":50,"course":"ES3103","type":"Theory","room":"101"},
      {"id":"thu-0855-ls3102-theory-102","day":"Thursday","time":"08:55","minutes":535,"duration":50,"course":"LS3102","type":"Theory","room":"102"},
      {"id":"thu-0855-ls4106-theory-111","day":"Thursday","time":"08:55","minutes":535,"duration":50,"course":"LS4106","type":"Theory","room":"111"},
      {"id":"thu-0855-ls5101-theory-108","day":"Thursday","time":"08:55","minutes":535,"duration":50,"course":"LS5101","type":"Theory","room":"108"},
      {"id":"thu-0855-ma2101-tutorial-ramanujan-virtual-classroom","day":"Thursday","time":"08:55","minutes":535,"duration":50,"course":"MA2101","type":"Tutorial","room":"Ramanujan Virtual Classroom"},
      {"id":"thu-0855-ma3104-theory-g09","day":"Thursday","time":"08:55","minutes":535,"duration":50,"course":"MA3104","type":"Theory","room":"G09"},
      {"id":"thu-0855-ma4112-theory-209","day":"Thursday","time":"08:55","minutes":535,"duration":50,"course":"MA4112","type":"Theory","room":"209"},
      {"id":"thu-0855-ma5102-theory-211","day":"Thursday","time":"08:55","minutes":535,"duration":50,"course":"MA5102","type":"Theory","room":"211"},
      {"id":"thu-0855-ph4102-theory-d-n-wadia-lecture-theatre","day":"Thursday","time":"08:55","minutes":535,"duration":50,"course":"PH4102","type":"Theory","room":"D N Wadia Lecture Theatre"},
      {"id":"thu-0855-ph4106-theory-103","day":"Thursday","time":"08:55","minutes":535,"duration":50,"course":"PH4106","type":"Theory","room":"103"},
      {"id":"thu-0855-ph5113-theory-111","day":"Thursday","time":"08:55","minutes":535,"duration":50,"course":"PH5113","type":"Theory","room":"111"},
      {"id":"thu-0950-ch3101-theory-g08","day":"Thursday","time":"09:50","minutes":590,"duration":50,"course":"CH3101","type":"Theory","room":"G08"},
      {"id":"thu-0950-ch4102-theory-102","day":"Thursday","time":"09:50","minutes":590,"duration":50,"course":"CH4102","type":"Theory","room":"102"},
      {"id":"thu-0950-ch5102-theory-201","day":"Thursday","time":"09:50","minutes":590,"duration":50,"course":"CH5102","type":"Theory","room":"201"},
      {"id":"thu-0950-es4101-theory-101","day":"Thursday","time":"09:50","minutes":590,"duration":50,"course":"ES4101","type":"Theory","room":"101"},
      {"id":"thu-0950-ls4103-theory-103","day":"Thursday","time":"09:50","minutes":590,"duration":50,"course":"LS4103","type":"Theory","room":"103"},
      {"id":"thu-0950-ma3101-theory-g09","day":"Thursday","time":"09:50","minutes":590,"duration":50,"course":"MA3101","type":"Theory","room":"G09"},
      {"id":"thu-0950-ma4110-theory-211","day":"Thursday","time":"09:50","minutes":590,"duration":50,"course":"MA4110","type":"Theory","room":"211"},
      {"id":"thu-0950-ph4110-theory-112","day":"Thursday","time":"09:50","minutes":590,"duration":50,"course":"PH4110","type":"Theory","room":"112"},
      {"id":"thu-1045-ch3106-theory-102","day":"Thursday","time":"10:45","minutes":645,"duration":50,"course":"CH3106","type":"Theory","room":"102"},
      {"id":"thu-1045-ch4115-theory-g09","day":"Thursday","time":"10:45","minutes":645,"duration":50,"course":"CH4115","type":"Theory","room":"G09"},
      {"id":"thu-1045-ch4116-theory-101","day":"Thursday","time":"10:45","minutes":645,"duration":50,"course":"CH4116","type":"Theory","room":"101"},
      {"id":"thu-1045-cs4103-theory-g02","day":"Thursday","time":"10:45","minutes":645,"duration":50,"course":"CS4103","type":"Theory","room":"G02"},
      {"id":"thu-1045-hu4102-theory-111","day":"Thursday","time":"10:45","minutes":645,"duration":50,"course":"HU4102","type":"Theory","room":"111"},
      {"id":"thu-1045-hu4103-theory-108","day":"Thursday","time":"10:45","minutes":645,"duration":50,"course":"HU4103","type":"Theory","room":"108"},
      {"id":"thu-1045-ls2103-tutorial-ramanujan-virtual-classroom","day":"Thursday","time":"10:45","minutes":645,"duration":50,"course":"LS2103","type":"Tutorial","room":"Ramanujan Virtual Classroom"},
      {"id":"thu-1045-ls4105-theory-112","day":"Thursday","time":"10:45","minutes":645,"duration":50,"course":"LS4105","type":"Theory","room":"112"},
      {"id":"thu-1045-ma3103-theory-211","day":"Thursday","time":"10:45","minutes":645,"duration":50,"course":"MA3103","type":"Theory","room":"211"},
      {"id":"thu-1045-ph5114-theory-201","day":"Thursday","time":"10:45","minutes":645,"duration":50,"course":"PH5114","type":"Theory","room":"201"},
      {"id":"thu-1140-es2103-theory-ramanujan-virtual-classroom","day":"Thursday","time":"11:40","minutes":700,"duration":50,"course":"ES2103","type":"Theory","room":"Ramanujan Virtual Classroom"},
      {"id":"thu-1140-ls3101-theory-102","day":"Thursday","time":"11:40","minutes":700,"duration":50,"course":"LS3101","type":"Theory","room":"102"},
      {"id":"thu-1140-ls5101-theory-108","day":"Thursday","time":"11:40","minutes":700,"duration":50,"course":"LS5101","type":"Theory","room":"108"},
      {"id":"thu-1140-ma3109-theory-g09","day":"Thursday","time":"11:40","minutes":700,"duration":50,"course":"MA3109","type":"Theory","room":"G09"},
      {"id":"thu-1140-ma5126-theory-211","day":"Thursday","time":"11:40","minutes":700,"duration":50,"course":"MA5126","type":"Theory","room":"211"},
      {"id":"thu-1140-ph3102-theory-g02","day":"Thursday","time":"11:40","minutes":700,"duration":50,"course":"PH3102","type":"Theory","room":"G02"},
      {"id":"thu-1330-ch3105-lab-dcs-3rd-year-lab-1","day":"Thursday","time":"13:30","minutes":810,"duration":160,"course":"CH3105","type":"Lab","room":"DCS 3rd Year Lab 1"},
      {"id":"thu-1330-ch4118-lab-dcs-4th-year-lab","day":"Thursday","time":"13:30","minutes":810,"duration":160,"course":"CH4118","type":"Lab","room":"DCS 4th Year Lab"},
      {"id":"thu-1330-ch4123-lab-dcs-4th-year-lab-1","day":"Thursday","time":"13:30","minutes":810,"duration":160,"course":"CH4123","type":"Lab","room":"DCS 4th Year Lab 1"},
      {"id":"thu-1330-ch4124-lab-dcs-4th-year-lab-2","day":"Thursday","time":"13:30","minutes":810,"duration":160,"course":"CH4124","type":"Lab","room":"DCS 4th Year Lab 2"},
      {"id":"thu-1330-es3102-lab-des-3rd-year-lab","day":"Thursday","time":"13:30","minutes":810,"duration":160,"course":"ES3102","type":"Lab","room":"DES 3rd Year Lab"},
      {"id":"thu-1330-es3104-lab-des-3rd-year-lab-1","day":"Thursday","time":"13:30","minutes":810,"duration":160,"course":"ES3104","type":"Lab","room":"DES 3rd Year Lab 1"},
      {"id":"thu-1330-es4102-lab-des-4th-year-lab","day":"Thursday","time":"13:30","minutes":810,"duration":160,"course":"ES4102","type":"Lab","room":"DES 4th Year Lab"},
      {"id":"thu-1330-es4104-lab-des-4th-year-lab-1","day":"Thursday","time":"13:30","minutes":810,"duration":160,"course":"ES4104","type":"Lab","room":"DES 4th Year Lab 1"},
      {"id":"thu-1330-es4106-lab-des-4th-year-lab-2","day":"Thursday","time":"13:30","minutes":810,"duration":160,"course":"ES4106","type":"Lab","room":"DES 4th Year Lab 2"},
      {"id":"thu-1330-ls3104-lab-dbs-3rd-year-lab","day":"Thursday","time":"13:30","minutes":810,"duration":160,"course":"LS3104","type":"Lab","room":"DBS 3rd Year Lab"},
      {"id":"thu-1330-ls3105-lab-dbs-3rd-year-lab-1","day":"Thursday","time":"13:30","minutes":810,"duration":160,"course":"LS3105","type":"Lab","room":"DBS 3rd Year Lab 1"},
      {"id":"thu-1330-ls3106-lab-dbs-3rd-year-lab-2","day":"Thursday","time":"13:30","minutes":810,"duration":160,"course":"LS3106","type":"Lab","room":"DBS 3rd Year Lab 2"},
      {"id":"thu-1330-ls4104-lab-dbs-4th-year-lab","day":"Thursday","time":"13:30","minutes":810,"duration":160,"course":"LS4104","type":"Lab","room":"DBS 4th Year Lab"},
      {"id":"thu-1330-ls4114-lab-dbs-4th-year-lab-1","day":"Thursday","time":"13:30","minutes":810,"duration":160,"course":"LS4114","type":"Lab","room":"DBS 4th Year Lab 1"},
      {"id":"thu-1330-ma4111-lab-dms-4th-year-lab","day":"Thursday","time":"13:30","minutes":810,"duration":160,"course":"MA4111","type":"Lab","room":"DMS 4th Year Lab"},
      {"id":"thu-1330-ph2101-theory-s-n-bose-lecture-theatre","day":"Thursday","time":"13:30","minutes":810,"duration":50,"course":"PH2101","type":"Theory","room":"S N Bose Lecture Theatre"},
      {"id":"thu-1330-ph3105-lab-dps-3rd-year-lab","day":"Thursday","time":"13:30","minutes":810,"duration":160,"course":"PH3105","type":"Lab","room":"DPS 3rd Year Lab"},
      {"id":"thu-1330-ph4103-lab-dps-4th-year-lab","day":"Thursday","time":"13:30","minutes":810,"duration":160,"course":"PH4103","type":"Lab","room":"DPS 4th Year Lab"},
      {"id":"thu-1425-ma2101-theory-ramanujan-virtual-classroom","day":"Thursday","time":"14:25","minutes":865,"duration":50,"course":"MA2101","type":"Theory","room":"Ramanujan Virtual Classroom"},
      {"id":"thu-1520-ph2104-theory-s-n-bose-lecture-theatre","day":"Thursday","time":"15:20","minutes":920,"duration":50,"course":"PH2104","type":"Theory","room":"S N Bose Lecture Theatre"},
      {"id":"thu-1615-ch3103-theory-g02","day":"Thursday","time":"16:15","minutes":975,"duration":50,"course":"CH3103","type":"Theory","room":"G02"},
      {"id":"thu-1615-ch4120-theory-111","day":"Thursday","time":"16:15","minutes":975,"duration":50,"course":"CH4120","type":"Theory","room":"111"},
      {"id":"thu-1615-es3108-theory-101","day":"Thursday","time":"16:15","minutes":975,"duration":50,"course":"ES3108","type":"Theory","room":"101"},
      {"id":"thu-1615-ls2101-theory-s-n-bose-lecture-theatre","day":"Thursday","time":"16:15","minutes":975,"duration":50,"course":"LS2101","type":"Theory","room":"S N Bose Lecture Theatre"},
      {"id":"thu-1615-ls4109-theory-g09","day":"Thursday","time":"16:15","minutes":975,"duration":50,"course":"LS4109","type":"Theory","room":"G09"},
      {"id":"thu-1615-ls5103-theory-108","day":"Thursday","time":"16:15","minutes":975,"duration":50,"course":"LS5103","type":"Theory","room":"108"},
      {"id":"thu-1615-ma5122-theory-211","day":"Thursday","time":"16:15","minutes":975,"duration":50,"course":"MA5122","type":"Theory","room":"211"},
      {"id":"thu-1615-ph4104-theory-102","day":"Thursday","time":"16:15","minutes":975,"duration":50,"course":"PH4104","type":"Theory","room":"102"},
      {"id":"thu-1615-ph5103-theory-112","day":"Thursday","time":"16:15","minutes":975,"duration":50,"course":"PH5103","type":"Theory","room":"112"},
      {"id":"thu-1710-ch3103-tutorial-g02","day":"Thursday","time":"17:10","minutes":1030,"duration":50,"course":"CH3103","type":"Tutorial","room":"G02"},
      {"id":"thu-1710-ch4120-tutorial-111","day":"Thursday","time":"17:10","minutes":1030,"duration":50,"course":"CH4120","type":"Tutorial","room":"111"},
      {"id":"thu-1710-cs2101-tutorial-ramanujan-virtual-classroom","day":"Thursday","time":"17:10","minutes":1030,"duration":50,"course":"CS2101","type":"Tutorial","room":"Ramanujan Virtual Classroom"},
      {"id":"thu-1710-es2104-tutorial-d-n-wadia-lecture-theatre","day":"Thursday","time":"17:10","minutes":1030,"duration":50,"course":"ES2104","type":"Tutorial","room":"D N Wadia Lecture Theatre"},
      {"id":"thu-1710-es3108-tutorial-101","day":"Thursday","time":"17:10","minutes":1030,"duration":50,"course":"ES3108","type":"Tutorial","room":"101"},
      {"id":"thu-1710-ls4109-tutorial-g09","day":"Thursday","time":"17:10","minutes":1030,"duration":50,"course":"LS4109","type":"Tutorial","room":"G09"},
      {"id":"thu-1710-ls5103-tutorial-108","day":"Thursday","time":"17:10","minutes":1030,"duration":50,"course":"LS5103","type":"Tutorial","room":"108"},
      {"id":"thu-1710-ph4104-tutorial-102","day":"Thursday","time":"17:10","minutes":1030,"duration":50,"course":"PH4104","type":"Tutorial","room":"102"},
      {"id":"thu-1710-ph5103-tutorial-112","day":"Thursday","time":"17:10","minutes":1030,"duration":50,"course":"PH5103","type":"Tutorial","room":"112"},
      {"id":"fri-0800-ch4111-tutorial-g09","day":"Friday","time":"08:00","minutes":480,"duration":50,"course":"CH4111","type":"Tutorial","room":"G09"},
      {"id":"fri-0800-ch4125-tutorial-108","day":"Friday","time":"08:00","minutes":480,"duration":50,"course":"CH4125","type":"Tutorial","room":"108"},
      {"id":"fri-0800-ch5103-tutorial-201","day":"Friday","time":"08:00","minutes":480,"duration":50,"course":"CH5103","type":"Tutorial","room":"201"},
      {"id":"fri-0800-es4107-tutorial-111","day":"Friday","time":"08:00","minutes":480,"duration":50,"course":"ES4107","type":"Tutorial","room":"111"},
      {"id":"fri-0800-ls2101-tutorial-s-n-bose-lecture-theatre","day":"Friday","time":"08:00","minutes":480,"duration":50,"course":"LS2101","type":"Tutorial","room":"S N Bose Lecture Theatre"},
      {"id":"fri-0800-ls4107-tutorial-102","day":"Friday","time":"08:00","minutes":480,"duration":50,"course":"LS4107","type":"Tutorial","room":"102"},
      {"id":"fri-0800-ls4112-tutorial-112","day":"Friday","time":"08:00","minutes":480,"duration":50,"course":"LS4112","type":"Tutorial","room":"112"},
      {"id":"fri-0800-ma4104-tutorial-211","day":"Friday","time":"08:00","minutes":480,"duration":50,"course":"MA4104","type":"Tutorial","room":"211"},
      {"id":"fri-0800-ph3103-tutorial-g02","day":"Friday","time":"08:00","minutes":480,"duration":50,"course":"PH3103","type":"Tutorial","room":"G02"},
      {"id":"fri-0855-ch4111-theory-g09","day":"Friday","time":"08:55","minutes":535,"duration":50,"course":"CH4111","type":"Theory","room":"G09"},
      {"id":"fri-0855-ch4125-theory-108","day":"Friday","time":"08:55","minutes":535,"duration":50,"course":"CH4125","type":"Theory","room":"108"},
      {"id":"fri-0855-ch5103-theory-201","day":"Friday","time":"08:55","minutes":535,"duration":50,"course":"CH5103","type":"Theory","room":"201"},
      {"id":"fri-0855-es4107-theory-111","day":"Friday","time":"08:55","minutes":535,"duration":50,"course":"ES4107","type":"Theory","room":"111"},
      {"id":"fri-0855-ls4107-theory-102","day":"Friday","time":"08:55","minutes":535,"duration":50,"course":"LS4107","type":"Theory","room":"102"},
      {"id":"fri-0855-ls4112-theory-112","day":"Friday","time":"08:55","minutes":535,"duration":50,"course":"LS4112","type":"Theory","room":"112"},
      {"id":"fri-0855-ma2104-theory-ramanujan-virtual-classroom","day":"Friday","time":"08:55","minutes":535,"duration":50,"course":"MA2104","type":"Theory","room":"Ramanujan Virtual Classroom"},
      {"id":"fri-0855-ma4104-theory-211","day":"Friday","time":"08:55","minutes":535,"duration":50,"course":"MA4104","type":"Theory","room":"211"},
      {"id":"fri-0855-ph3103-theory-g02","day":"Friday","time":"08:55","minutes":535,"duration":50,"course":"PH3103","type":"Theory","room":"G02"},
      {"id":"fri-0950-ch2104-tutorial-d-n-wadia-lecture-theatre","day":"Friday","time":"09:50","minutes":590,"duration":50,"course":"CH2104","type":"Tutorial","room":"D N Wadia Lecture Theatre"},
      {"id":"fri-0950-ch2104-tutorial-ramanujan-virtual-classroom","day":"Friday","time":"09:50","minutes":590,"duration":50,"course":"CH2104","type":"Tutorial","room":"Ramanujan Virtual Classroom"},
      {"id":"fri-0950-ch4114-theory-209","day":"Friday","time":"09:50","minutes":590,"duration":50,"course":"CH4114","type":"Theory","room":"209"},
      {"id":"fri-0950-ch4117-theory-108","day":"Friday","time":"09:50","minutes":590,"duration":50,"course":"CH4117","type":"Theory","room":"108"},
      {"id":"fri-0950-ch5104-theory-212","day":"Friday","time":"09:50","minutes":590,"duration":50,"course":"CH5104","type":"Theory","room":"212"},
      {"id":"fri-0950-es3105-theory-102","day":"Friday","time":"09:50","minutes":590,"duration":50,"course":"ES3105","type":"Theory","room":"102"},
      {"id":"fri-0950-es4103-theory-112","day":"Friday","time":"09:50","minutes":590,"duration":50,"course":"ES4103","type":"Theory","room":"112"},
      {"id":"fri-0950-ls3103-theory-103","day":"Friday","time":"09:50","minutes":590,"duration":50,"course":"LS3103","type":"Theory","room":"103"},
      {"id":"fri-0950-ls4115-theory-111","day":"Friday","time":"09:50","minutes":590,"duration":50,"course":"LS4115","type":"Theory","room":"111"},
      {"id":"fri-0950-ma3110-theory-g09","day":"Friday","time":"09:50","minutes":590,"duration":50,"course":"MA3110","type":"Theory","room":"G09"},
      {"id":"fri-0950-ma4107-theory-211","day":"Friday","time":"09:50","minutes":590,"duration":50,"course":"MA4107","type":"Theory","room":"211"},
      {"id":"fri-0950-ph4108-theory-201","day":"Friday","time":"09:50","minutes":590,"duration":50,"course":"PH4108","type":"Theory","room":"201"},
      {"id":"fri-1045-ch3102-theory-g02","day":"Friday","time":"10:45","minutes":645,"duration":50,"course":"CH3102","type":"Theory","room":"G02"},
      {"id":"fri-1045-ch4107-theory-110","day":"Friday","time":"10:45","minutes":645,"duration":50,"course":"CH4107","type":"Theory","room":"110"},
      {"id":"fri-1045-ch4128-theory-101","day":"Friday","time":"10:45","minutes":645,"duration":50,"course":"CH4128","type":"Theory","room":"101"},
      {"id":"fri-1045-es4105-theory-108","day":"Friday","time":"10:45","minutes":645,"duration":50,"course":"ES4105","type":"Theory","room":"108"},
      {"id":"fri-1045-ma4101-theory-g09","day":"Friday","time":"10:45","minutes":645,"duration":50,"course":"MA4101","type":"Theory","room":"G09"},
      {"id":"fri-1045-ma4106-theory-211","day":"Friday","time":"10:45","minutes":645,"duration":50,"course":"MA4106","type":"Theory","room":"211"},
      {"id":"fri-1045-ph3104-theory-g08","day":"Friday","time":"10:45","minutes":645,"duration":50,"course":"PH3104","type":"Theory","room":"G08"},
      {"id":"fri-1045-ph4101-theory-d-n-wadia-lecture-theatre","day":"Friday","time":"10:45","minutes":645,"duration":50,"course":"PH4101","type":"Theory","room":"D N Wadia Lecture Theatre"},
      {"id":"fri-1140-ch3106-theory-102","day":"Friday","time":"11:40","minutes":700,"duration":50,"course":"CH3106","type":"Theory","room":"102"},
      {"id":"fri-1140-ch4115-theory-g09","day":"Friday","time":"11:40","minutes":700,"duration":50,"course":"CH4115","type":"Theory","room":"G09"},
      {"id":"fri-1140-ch4116-theory-101","day":"Friday","time":"11:40","minutes":700,"duration":50,"course":"CH4116","type":"Theory","room":"101"},
      {"id":"fri-1140-cs4103-theory-g02","day":"Friday","time":"11:40","minutes":700,"duration":50,"course":"CS4103","type":"Theory","room":"G02"},
      {"id":"fri-1140-hu4102-theory-111","day":"Friday","time":"11:40","minutes":700,"duration":50,"course":"HU4102","type":"Theory","room":"111"},
      {"id":"fri-1140-hu4103-theory-108","day":"Friday","time":"11:40","minutes":700,"duration":50,"course":"HU4103","type":"Theory","room":"108"},
      {"id":"fri-1140-ls4105-theory-112","day":"Friday","time":"11:40","minutes":700,"duration":50,"course":"LS4105","type":"Theory","room":"112"},
      {"id":"fri-1140-ma2102-theory-ramanujan-virtual-classroom","day":"Friday","time":"11:40","minutes":700,"duration":50,"course":"MA2102","type":"Theory","room":"Ramanujan Virtual Classroom"},
      {"id":"fri-1140-ma3103-theory-211","day":"Friday","time":"11:40","minutes":700,"duration":50,"course":"MA3103","type":"Theory","room":"211"},
      {"id":"fri-1140-ph5114-theory-201","day":"Friday","time":"11:40","minutes":700,"duration":50,"course":"PH5114","type":"Theory","room":"201"},
      {"id":"fri-1330-ch2103-lab-dcs-2nd-year-lab","day":"Friday","time":"13:30","minutes":810,"duration":160,"course":"CH2103","type":"Lab","room":"DCS 2nd Year Lab"},
      {"id":"fri-1330-ch3103-theory-g02","day":"Friday","time":"13:30","minutes":810,"duration":50,"course":"CH3103","type":"Theory","room":"G02"},
      {"id":"fri-1330-cs2103-lab-computer-lab-1","day":"Friday","time":"13:30","minutes":810,"duration":160,"course":"CS2103","type":"Lab","room":"Computer Lab 1"},
      {"id":"fri-1330-es2105-lab-des-2nd-year-lab","day":"Friday","time":"13:30","minutes":810,"duration":160,"course":"ES2105","type":"Lab","room":"DES 2nd Year Lab"},
      {"id":"fri-1330-es3108-theory-101","day":"Friday","time":"13:30","minutes":810,"duration":50,"course":"ES3108","type":"Theory","room":"101"},
      {"id":"fri-1330-ls2102-lab-dbs-2nd-year-lab","day":"Friday","time":"13:30","minutes":810,"duration":160,"course":"LS2102","type":"Lab","room":"DBS 2nd Year Lab"},
      {"id":"fri-1330-ls4109-theory-g09","day":"Friday","time":"13:30","minutes":810,"duration":50,"course":"LS4109","type":"Theory","room":"G09"},
      {"id":"fri-1330-ls5103-theory-108","day":"Friday","time":"13:30","minutes":810,"duration":50,"course":"LS5103","type":"Theory","room":"108"},
      {"id":"fri-1330-ma5122-theory-211","day":"Friday","time":"13:30","minutes":810,"duration":50,"course":"MA5122","type":"Theory","room":"211"},
      {"id":"fri-1330-ph2103-lab-dps-2nd-year-lab","day":"Friday","time":"13:30","minutes":810,"duration":160,"course":"PH2103","type":"Lab","room":"DPS 2nd Year Lab"},
      {"id":"fri-1330-ph4104-theory-102","day":"Friday","time":"13:30","minutes":810,"duration":50,"course":"PH4104","type":"Theory","room":"102"},
      {"id":"fri-1330-ph5103-theory-112","day":"Friday","time":"13:30","minutes":810,"duration":50,"course":"PH5103","type":"Theory","room":"112"},
      {"id":"fri-1425-ch4121-theory-103","day":"Friday","time":"14:25","minutes":865,"duration":50,"course":"CH4121","type":"Theory","room":"103"},
      {"id":"fri-1425-ch4126-theory-201","day":"Friday","time":"14:25","minutes":865,"duration":50,"course":"CH4126","type":"Theory","room":"201"},
      {"id":"fri-1425-es3101-theory-101","day":"Friday","time":"14:25","minutes":865,"duration":50,"course":"ES3101","type":"Theory","room":"101"},
      {"id":"fri-1425-es4108-theory-108","day":"Friday","time":"14:25","minutes":865,"duration":50,"course":"ES4108","type":"Theory","room":"108"},
      {"id":"fri-1425-ls4101-theory-102","day":"Friday","time":"14:25","minutes":865,"duration":50,"course":"LS4101","type":"Theory","room":"102"},
      {"id":"fri-1425-ma4102-theory-g09","day":"Friday","time":"14:25","minutes":865,"duration":50,"course":"MA4102","type":"Theory","room":"G09"},
      {"id":"fri-1425-ph3101-theory-g02","day":"Friday","time":"14:25","minutes":865,"duration":50,"course":"PH3101","type":"Theory","room":"G02"},
      {"id":"fri-1425-ph4107-theory-112","day":"Friday","time":"14:25","minutes":865,"duration":50,"course":"PH4107","type":"Theory","room":"112"},
      {"id":"fri-1520-ch3104-theory-g02","day":"Friday","time":"15:20","minutes":920,"duration":50,"course":"CH3104","type":"Theory","room":"G02"},
      {"id":"fri-1520-ch4105-theory-101","day":"Friday","time":"15:20","minutes":920,"duration":50,"course":"CH4105","type":"Theory","room":"101"},
      {"id":"fri-1520-ch4109-theory-112","day":"Friday","time":"15:20","minutes":920,"duration":50,"course":"CH4109","type":"Theory","room":"112"},
      {"id":"fri-1520-ch4122-theory-108","day":"Friday","time":"15:20","minutes":920,"duration":50,"course":"CH4122","type":"Theory","room":"108"},
      {"id":"fri-1520-ls2101-theory-s-n-bose-lecture-theatre","day":"Friday","time":"15:20","minutes":920,"duration":50,"course":"LS2101","type":"Theory","room":"S N Bose Lecture Theatre"},
      {"id":"fri-1520-ls4102-theory-102","day":"Friday","time":"15:20","minutes":920,"duration":50,"course":"LS4102","type":"Theory","room":"102"},
      {"id":"fri-1520-ls4113-theory-111","day":"Friday","time":"15:20","minutes":920,"duration":50,"course":"LS4113","type":"Theory","room":"111"},
      {"id":"fri-1520-ma3108-theory-g09","day":"Friday","time":"15:20","minutes":920,"duration":50,"course":"MA3108","type":"Theory","room":"G09"},
      {"id":"fri-1520-ma5125-theory-211","day":"Friday","time":"15:20","minutes":920,"duration":50,"course":"MA5125","type":"Theory","room":"211"},
      {"id":"fri-1520-ph4113-theory-g08","day":"Friday","time":"15:20","minutes":920,"duration":50,"course":"PH4113","type":"Theory","room":"G08"},
      {"id":"fri-1615-ch3101-theory-g08","day":"Friday","time":"16:15","minutes":975,"duration":50,"course":"CH3101","type":"Theory","room":"G08"},
      {"id":"fri-1615-ch4102-theory-102","day":"Friday","time":"16:15","minutes":975,"duration":50,"course":"CH4102","type":"Theory","room":"102"},
      {"id":"fri-1615-ch5102-theory-201","day":"Friday","time":"16:15","minutes":975,"duration":50,"course":"CH5102","type":"Theory","room":"201"},
      {"id":"fri-1615-cs2101-theory-ramanujan-virtual-classroom","day":"Friday","time":"16:15","minutes":975,"duration":50,"course":"CS2101","type":"Theory","room":"Ramanujan Virtual Classroom"},
      {"id":"fri-1615-es4101-theory-101","day":"Friday","time":"16:15","minutes":975,"duration":50,"course":"ES4101","type":"Theory","room":"101"},
      {"id":"fri-1615-ls4103-theory-103","day":"Friday","time":"16:15","minutes":975,"duration":50,"course":"LS4103","type":"Theory","room":"103"},
      {"id":"fri-1615-ma3101-theory-g09","day":"Friday","time":"16:15","minutes":975,"duration":50,"course":"MA3101","type":"Theory","room":"G09"},
      {"id":"fri-1615-ph4110-theory-112","day":"Friday","time":"16:15","minutes":975,"duration":50,"course":"PH4110","type":"Theory","room":"112"},
      {"id":"fri-1710-ch3101-tutorial-g08","day":"Friday","time":"17:10","minutes":1030,"duration":50,"course":"CH3101","type":"Tutorial","room":"G08"},
      {"id":"fri-1710-ch4102-tutorial-102","day":"Friday","time":"17:10","minutes":1030,"duration":50,"course":"CH4102","type":"Tutorial","room":"102"},
      {"id":"fri-1710-ch5102-tutorial-201","day":"Friday","time":"17:10","minutes":1030,"duration":50,"course":"CH5102","type":"Tutorial","room":"201"},
      {"id":"fri-1710-es4101-tutorial-101","day":"Friday","time":"17:10","minutes":1030,"duration":50,"course":"ES4101","type":"Tutorial","room":"101"},
      {"id":"fri-1710-ls4103-tutorial-103","day":"Friday","time":"17:10","minutes":1030,"duration":50,"course":"LS4103","type":"Tutorial","room":"103"},
      {"id":"fri-1710-ma3101-tutorial-g09","day":"Friday","time":"17:10","minutes":1030,"duration":50,"course":"MA3101","type":"Tutorial","room":"G09"},
      {"id":"fri-1710-ma4110-tutorial-211","day":"Friday","time":"17:10","minutes":1030,"duration":50,"course":"MA4110","type":"Tutorial","room":"211"},
      {"id":"fri-1710-ph4110-tutorial-112","day":"Friday","time":"17:10","minutes":1030,"duration":50,"course":"PH4110","type":"Tutorial","room":"112"}
    ]
  };

  global.TIMETABLE_DATA = DATA;
})(typeof globalThis !== 'undefined' ? globalThis : self);
