# Run after 01_surface.py in the same MCP-owned namespace.
# Continuous outer ground; the playing square stays bare soil.
cube('Yard foundation',(0,-.06,0),(13,.1,11),'soil')
# Timber decks left, right and foreground, with individual planks and small joints.
for side in [-1,1]:
 cx=side*2.80
 cube('Deck dark subframe',(cx,.04,.10),(1.95,.16,5.3),'edge',.015)
 for i in range(31):
  z=-2.47+i*.17
  cube('Cedar deck board',(cx,.14,z),(1.95,.06,.158),'wood' if i%3 else 'wood2',.006)
for i in range(12):
 cube('Entry timber board',(0,.08,2.05+i*.15),(7.6,.06,.14),'wood' if i%4 else 'wood2',.005)
# Slatted back fence, with visible rails, posts and individually spaced boards.
for x in [-4.1,-2.05,0,2.05,4.1]:cube('Fence structural post',(x,.85,-3.15),(.12,1.7,.12),'edge',.009)
for h in [.4,1.25]:cube('Fence horizontal rail',(0,h,-3.20),(8.5,.09,.10),'edge')
for i in range(69):cube('Vertical cedar fence slat',(-4.15+i*.123,.85,-3.1),(.112,1.6,.045),'edge' if i%5 else 'wood',.003)
# Glass garden room at left, angled by perspective rather than baked painting.
cube('Garden room plaster rear',(-4.3,1.10,-.45),(.18,2.2,4.1),'wall',.025)
cube('Garden room north return',(-3.48,1.10,-2.5),(1.8,2.2,.16),'wall',.025)
cube('Interior floor',(-3.5,.13,-.45),(1.8,.08,4.1),'wood')
for z in [-2.43,-1.44,-.45,.54,1.53]:
 cube('Glazing vertical mullion',(-2.56,1.07,z),(.06,2.0,.045),'edge',.003)
for h in [.18,2.08]:cube('Glazing horizontal frame',(-2.56,h,-.45),(.065,.055,4.05),'edge')
for z in [-1.935,-.945,.045,1.035]:
 glass=cube('Reflective glass pane',(-2.58,1.11,z),(.013,1.82,.935),'glass')
for i in range(21):cube('Facade roof fascia slat',(-2.5,2.23,-2.48+i*.195),(.075,.25,.183),'edge',.004)
cube('Garden room roof',(-3.51,2.35,-.45),(2.12,.13,4.3),'edge',.02)
# Lounge on right deck: individual slats, legs, rounded seat cushions, back and pillows.
for z in [-.4,.95]:
 for x in [2.25,3.18]:cube('Sofa timber leg',(x,.32,z),(.07,.39,.07),'wood',.008)
cube('Sofa front apron',(2.16,.47,.28),(.065,.15,1.65),'wood',.008)
for z in [-.43+i*.105 for i in range(16)]:cube('Sofa seat slat',(2.72,.50,z),(1.18,.045,.092),'wood2',.004)
for z in [-.10,.68]:cube('Seat cushion',(2.66,.61,z),(.94,.18,.74),'cushion',.055)
cube('Sofa back frame',(3.20,.88,.29),(.08,.76,1.8),'wood',.012)
for z in [-.10,.68]:
 o=cube('Back cushion',(3.10,.94,z),(.17,.52,.73),'cushion',.055);o.rotation_euler.y=-.12
 o=cube('Loose linen pillow',(2.96,1.0,z+.10),(.19,.40,.40),'cushion',.075);o.rotation_euler.x=.2;o.rotation_euler.y=-.25
# A round low coffee table stays off the playable earth.
cylinder('Round oak tabletop',(2.20,.49,1.55),(2.20,.54,1.55),.35,.35,'wood2',48)
for angle in [0,2.094,4.189]:
 x=2.2+math.cos(angle)*.22;z=1.55+math.sin(angle)*.22;cylinder('Coffee table leg',(x,.15,z),(x,.49,z),.025,.021,'wood',10)
for x,z in [(2.09,1.52),(2.29,1.58)]:
 cylinder('Tea saucer',(x,.548,z),(x,.56,z),.065,.065,'wall',24)
 cylinder('Ceramic tea cup',(x,.565,z),(x,.63,z),.035,.043,'wall',20)
 cylinder('Tea surface',(x,.629,z),(x,.631,z),.033,.033,'wood',20)
# Stone steps and rounded border boulders, never intruding into the white boundary.
for i in range(7):
 x=-1.88-.10*math.sin(i);z=-1.9+i*.56
 o=ico('Garden stepping stone',(x,.04,z),(.20,.08,.25),'stone',2);o.rotation_euler.z=rng.uniform(-.5,.5)
for x,z,scale in [(-2.12,1.7,.32),(1.98,-1.66,.36),(2.05,2.15,.27),(-1.94,-2.0,.24),(.35,-2.2,.38)]:
 o=ico('Garden edge boulder',(x,.12,z),(scale,.24,scale*.8),'stone',2);o.rotation_euler.z=rng.random()
print('Architecture complete:',len(ENV.objects),'objects')
