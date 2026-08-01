import zlib
import struct

def make_png(width, height, filename):
    png_header = b'\x89PNG\r\n\x1a\n'
    
    ihdr_data = struct.pack('>IIBBEEE', width, height, 8, 2, 0, 0, 0)
    ihdr_crc = zlib.crc32(b'IHDR' + ihdr_data)
    ihdr_chunk = struct.pack('>I', len(ihdr_data)) + b'IHDR' + ihdr_data + struct.pack('>I', ihdr_crc)
    
    # Indigo Background (#6366f1)
    row_bytes = b'\x00' + (b'\x63\x66\xf1' * width)
    raw_data = row_bytes * height
    
    compressed_data = zlib.compress(raw_data)
    idat_crc = zlib.crc32(b'IDAT' + compressed_data)
    idat_chunk = struct.pack('>I', len(compressed_data)) + b'IDAT' + compressed_data + struct.pack('>I', idat_crc)
    
    iend_crc = zlib.crc32(b'IEND')
    iend_chunk = struct.pack('>I', 0) + b'IEND' + struct.pack('>I', iend_crc)
    
    with open(filename, 'wb') as f:
        f.write(png_header + ihdr_chunk + idat_chunk + iend_chunk)

make_png(192, 192, 'c:/Users/Lenovo/Downloads/PulseChat-mongodb/PulseChat/frontend/public/icon-192.png')
make_png(512, 512, 'c:/Users/Lenovo/Downloads/PulseChat-mongodb/PulseChat/frontend/public/icon-512.png')
print("Successfully generated icon-192.png and icon-512.png")
