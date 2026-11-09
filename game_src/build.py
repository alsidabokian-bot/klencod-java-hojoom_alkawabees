import sys
order = ['math.js','audio.js','meshes.js','renderer.js','physics.js','world.js','player.js','character.js','gear.js','giant.js','combat.js','game.js','input.js','main.js']
js = '\n'.join(open(f, encoding='utf-8').read() for f in order)
t = open('template.html', encoding='utf-8').read().replace('/*JS*/', js)
out = sys.argv[1]
open(out, 'w', encoding='utf-8').write(t)
print('built', out, len(t), 'bytes')
