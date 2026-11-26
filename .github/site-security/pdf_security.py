"""Reject active PDF features in the actual bytes offered for download.

No rendering or text matching is used as a security decision. All indirect
objects, including compressed and unreferenced objects, are inspected.
"""
from functools import lru_cache
from io import BytesIO

from pypdf import PdfReader
from pypdf.generic import ArrayObject, DictionaryObject, IndirectObject

FORBIDDEN_KEYS = {
    '/OpenAction', '/AA', '/A', '/JS', '/JavaScript', '/URI', '/Launch',
    '/SubmitForm', '/ImportData', '/GoToR', '/GoToE', '/RichMedia',
    '/RichMediaContent', '/EmbeddedFiles', '/EF', '/XFA', '/AcroForm',
    '/Collection', '/3D', '/Sound', '/Movie', '/Rendition', '/FFilter',
}
FORBIDDEN_TYPES = {'/Filespec', '/EmbeddedFile', '/RichMedia', '/3D', '/Movie', '/Sound'}


@lru_cache(maxsize=128)
def validate_pdf(data):
    if len(data) > 32 * 1024 * 1024 or not data.startswith(b'%PDF-'):
        raise ValueError('Invalid or oversized PDF')
    try:
        reader = PdfReader(BytesIO(data), strict=True)
        if reader.is_encrypted or not reader.pages:
            raise ValueError('Encrypted or empty PDF')
        seen = set()
        count = 0

        def visit(obj, depth=0):
            nonlocal count
            if depth > 100:
                raise ValueError('PDF nesting limit')
            if isinstance(obj, IndirectObject):
                ref = (obj.idnum, obj.generation)
                if ref in seen:
                    return
                seen.add(ref)
                obj = obj.get_object()
            count += 1
            if count > 100000:
                raise ValueError('PDF object limit')
            if isinstance(obj, DictionaryObject):
                bad = FORBIDDEN_KEYS.intersection(obj.keys())
                if bad or str(obj.get('/Type', '')) in FORBIDDEN_TYPES:
                    raise ValueError('Active PDF object: ' + ', '.join(sorted(bad or {str(obj.get('/Type'))})))
                # A stream may load its data from an external file.
                if hasattr(obj, 'get_data') and '/F' in obj:
                    raise ValueError('External PDF stream')
                for value in obj.values():
                    visit(value, depth + 1)
            elif isinstance(obj, ArrayObject):
                for value in obj:
                    visit(value, depth + 1)

        visit(reader.trailer)
        for generation, entries in reader.xref.items():
            for number in entries:
                if number:
                    visit(IndirectObject(number, generation, reader))
        for number in reader.xref_objStm:
            visit(IndirectObject(number, 0, reader))
        return {'pages': len(reader.pages), 'objects': len(seen)}
    except Exception as exc:
        raise ValueError('Unsafe or unreadable PDF: ' + str(exc)) from exc
