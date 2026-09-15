import re

with open('src/pages/messages/MessagesCenter.tsx', 'r') as f:
    content = f.read()

# Find the start of the second `import React` and keep only from that point onwards
first_import = content.find("import React")
second_import = content.find("import React", first_import + 1)
third_import = content.find("import React", second_import + 1)

if third_import != -1:
    content = content[third_import:]
elif second_import != -1:
    content = content[second_import:]

with open('src/pages/messages/MessagesCenter.tsx', 'w') as f:
    f.write(content)
