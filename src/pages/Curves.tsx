import "../App.css";

const CurvesPage = () => {
  return (
    <div className="page curves-page">
      <header className="page-hero">
        <div>
          <p className="eyebrow">Hockey Sticks</p>
          <h1>Stick information: materials, curves, options</h1>
          <p className="hero-subline">
            Christmas is coming up and a stick is always a great gift! I've
            added some thoughts and recommendations below.
          </p>
        </div>
      </header>

      <div className="wrist-layout">
        <section className="stage-card">
          <p className="eyebrow">Stick Buying Guide</p>
          <h3>Upgrading to Composite</h3>
          <p>
            While a wood stick is definitely a solid choice for 8U and will work
            just fine, the difference between a wood stick and an entry level
            composite stick are drastic. My advice is not overspend here (less
            than $80).
          </p>
          <p>
            Some good options (prices are based on prices on 12/11/2025):
            <ul>
              <li>
                <a href="https://www.purehockey.com/product/bauer-vapor-composite-hockey-stick-youth/itm/65782-11/">
                  Bauer Vapor Composite Hockey Stick - Youth $70
                </a>
              </li>
              <li>
                <a href="https://www.purehockey.com/product/warrior-rise-composite-hockey-stick-youth/itm/66787-11/">
                  Warrior Rise Hockey Stick - Youth $70
                </a>
              </li>
              <li>
                <a href="https://www.purehockey.com/product/ccm-jetspeed-ft-composite-hockey-stick-youth/itm/63234-11/">
                  CCM Jetspeed FT Hockey Stick - Youth $70
                </a>
              </li>
            </ul>
          </p>
        </section>
        <section className="stage-card">
          <p className="eyebrow">Curve comparison</p>
          <h3>P28 vs P92</h3>
          <p className="hero-subline">
            The two most popular retail curves. P28 is toe-centric and rewards
            quick puck pickups and snap releases; P92 is a mid-curve all-rounder
            with a larger sweet spot.
          </p>
          <div className="note">
            These are specific to Bauer products. Other manufactures make
            similar or copycat curves.
          </div>
          <table className="spec-table">
            <thead>
              <tr>
                <th></th>
                <th>P28 (toe curve)</th>
                <th>P92 (mid/heel curve)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Curve focus</td>
                <td>Toe pocket; aggressive loft near the toe</td>
                <td>Mid-heel pocket; gradual loft</td>
              </tr>
              <tr>
                <td>Lie feel</td>
                <td>
                  Plays a touch more open; blade sits slightly off-ice at heel
                </td>
                <td>More neutral lie; easier full-ice contact</td>
              </tr>
              <tr>
                <td>Shot profile</td>
                <td>
                  Fast toe snaps, quick release, great for in-tight roof shots
                </td>
                <td>
                  Balanced wristers/slappers, predictable for catch-and-shoot
                </td>
              </tr>
              <tr>
                <td>Puck control</td>
                <td>
                  Excellent toe drags and puck pickup; smaller landing zone
                </td>
                <td>Larger sweet spot for saucers and receptions</td>
              </tr>
              <tr>
                <td>Typical users</td>
                <td>
                  Forwards who play in-tight, quick hands, pull-and-release
                  moves
                </td>
                <td>
                  All positions; players preferring reliable handling and
                  passing
                </td>
              </tr>
            </tbody>
          </table>
          <p className="hero-subline">
            Quick note: the P28 is the easiest curve to lift the puck with
            because of its toe pocket and open loft.
          </p>
        </section>

        <section className="stage-card">
          <p className="eyebrow">Materials</p>
          <h3>Composite vs. wood</h3>
          <ul className="cues">
            <li>
              <strong>Composite:</strong> lighter, consistent flex, dampens
              vibration, and offers defined kick points (low kick for quick
              release, mid kick for heavier loads). Costlier and can fracture
              instead of just chipping.
            </li>
            <li>
              <strong>Wood:</strong> heavier, more blade feel, inexpensive,
              predictable wear (chips/splinters), but flex is inconsistent and
              can soften unevenly with moisture and use.
            </li>
          </ul>
        </section>

        <section className="stage-card">
          <p className="eyebrow">Flex</p>
          <h3>What flex means</h3>
          <ul className="cues">
            <li>
              Flex is the force in pounds to bend the shaft 1 inch; a 50 flex
              needs ~50 lbs of force.
            </li>
            <li>
              Match flex to body mass and play style: lighter/younger players
              use lower flex; stronger shooters can size up for harder shots but
              risk slower release.
            </li>
            <li>
              Cutting the stick makes it stiffer; each inch cut raises effective
              flex roughly 3–4 points.
            </li>
            <li>
              Quick rule: start near half your body weight in pounds (e.g., 120
              lbs ≈ 60 flex) and adjust based on preference and how much you
              plan to cut.
            </li>
          </ul>
        </section>

        <section className="stage-card">
          <p className="eyebrow">Height</p>
          <h3>How to measure stick height</h3>
          <ul className="cues">
            <li>
              With skates on, stand the stick between your feet: chin-to-nose
              for forwards (better puck control/release), nose-to-brow for
              defense (reach/leverage).
            </li>
            <li>
              On shoes, subtract skate height: aim mouth-to-chin off-ice to end
              up chin-to-nose on-ice.
            </li>
            <li>
              After cutting, re-check lie: the flatter the blade sits in your
              stance, the better the puck contact.
            </li>
            <li>
              Mark your preferred length on the shaft so you can replicate it on
              new sticks before taping.
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
};

export default CurvesPage;
