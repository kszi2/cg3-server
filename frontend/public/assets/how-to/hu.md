# Programozás alapjai 1 házi statikus ellenőrző

## Mi is ez?

Ez egy egyszerűnek indult program, ami elég bonyolulttá nőtte már ki magát. A Prog 1-es házikhoz próbál sok segítséget adni, mindenféle statikus analízis eszközök segítségével.

### Honnan jött a név?

TLDR: cg = call graph, azaz eredetileg hívási gráfot generált volna a program, és ez a 3. verziója már.

## Használata

1. Tölts fel egy ZIP fájlt az 'Ellenőrzések' oldalon
2. Add meg a Neptun-kódodat
3. Kattints a feltöltés gombra
4. Várd meg, amíg lefut az ellenőrzés, ami ideális esetben 5-10 másodperc; Ilyenkor az oldal automatikusan újrapróbálkozik 5 másodpercenként, ezért kérlek ne spammeld az újratöltés gombot
5. Elemezd ki az eredményeket

A programot hallgatóként is használhatod, sőt, ajánlott is beadás előtt ide feltöltened, mert elég sok hibát ki tud szűrni a rendszer.

A program elsődlegesen a Prog 1 követelményeinek megfelelő ZIP fájlokat fogyasztja szívesen, az alábbi megkötésekkel:

- a ZIP legfeljebb 1 MiB méretű lehet
- nincs benne ZIP-bomb jegyekre utaló fájl
- C forráskód van benne
- van benne legalább 2 C fájl, 2 H fájl, 1 PDF fájl és debugmalloc is

Feltöltés után a program átirányít az eredmények oldalra, itt ha szeretnéd később is megnézni az eredményedet, akkor ajánlott az URL elmentése. Opcionálisan, ha ugyanazt a ZIP-et feltöltöd még egyszer, akkor is vissza fogod kapni az eredeti futtatás eredményét, mert a rendszer ugyanazt a ZIP-et csak egyszer elemzi ki.

Légyszi ne töltsétek fel a programot minden változtatás után, mert a szerverben végesen kevés tárhely van, és nem akarok bele ennél több SSD-t rakni, mert az drága.

### Neptun-kódok

A program a Neptun-kódodat csak arra használja, hogy a Prog 1-et jelenleg (vagy múltban) hallgató hallgatóktól fogadjon csak feltöltéseket a túlterheléses támadások elkerülése érdekében. A Neptun-kód nem kerül tárolásra, csupán a hash-e. Már a feltöltés során is csak a Neptun-kódód hash-elt verziója hagyja el a böngésződet. A kiértékelésnél lévő 6 karakteres "érték" a hash első 6 karaktere.

Ugyan a hash visszafejthető, nem valószínű, hogy ezt bárki is megtenné, mivel nincs túl sok értelme, és nem lehet belőle érdemlegesen sok információt kinyerni. Vannak sokkal egyszerűbb módok is emberek Neptun-kódjainak megszerzésére.

## Ellenőzrések

A program elég sok ellenőrzést futtat le, ezek esetenként függenek is egymástól, azaz ha az egyik sikertelen volt, akkor a többi sem fog lefutni.

Egy sikertelen ellenőrzés önmagában nem jelent bukást a tárgyból, csak jelzi, hogy a programmal valami potenciálisan nincs rendben. Például a a globus bejelez, attól még el lehet fogadni a programot, ha a globális változó nem a program lényegi adatszerkezete. Viszont ha a bugmalloc jelez be, az szinte biztos bukást jelent.

### unzip

Megnyitja és kibontja a beküldött ZIP-archívumot. Az archívumnak érvényesnek és biztonságosan kibonthatónak kell lennie.

### sanity

Ellenőrzi, hogy az archívum legalább 1 PDF-et, 2 C-forrásfájlt, 2 fejlécfájlt és 1 debugmalloc.h fájlt tartalmaz-e.

### compile

A programot GCC-vel, a -Wall, -Wextra, -Wpedantic és -Wvla kapcsolókkal fordítja. Az SDL2 vagy SDL3 fejléceinek szerepelniük kell, és a támogatott SDL-könyvtárak linkelve vannak.

### debugmalloc

Minden beillesztett debugmalloc.h fájlt összehasonlít a megadott InfoC-referenciával. Az eltérést jelzi, és a későbbi ellenőrzésekhez lecserélheti a fájlt.

### cg3-complete

A teljes CG3 statikusanalízist futtatja, beleértve az arityck, bugmalloc, chonktion, fio, fleak, globus, hunction és t ellenőrzéseket.

### cg3-arityck

Felsorolja a gyanúsan sok paraméterrel rendelkező függvényeket. Jelenleg legalább 5 paraméter esetén jelez.

### cg3-bugmalloc

Azokat a memóriafoglalási hívásokat keresi, amelyek nem a debugmalloc.h-n keresztül történnek, például malloc, calloc, realloc, free és strdup.

### cg3-chonktion

A valószínűleg szükségtelenül nagy függvényeket keresi. A legalább 64, 128 vagy 256 utasítást tartalmazó függvényeket jelzi.

### cg3-fio

Felsorolja a forráskódban talált fájlműveleteket. Ez az ellenőrzés a műveleteket jelzi, nem minősíti őket hibásnak.

### cg3-fleak

Valószínűsíthető fájlkezelő-szivárgásokat keres, például amikor egy függvény FILE-pointert vesz át, de nem zárja be és nem adja vissza.

### cg3-globus

Ellenőrzi, hogy a program tartalmaz-e globális változókat.

### cg3-hunction

Összegyűjti a fejlécfájlokban definiált függvényeket.

### cg3-t

Biztos nagyon hasznos.

### cg

Hívási gráfot készít a program függvényeiből. A hívási gráfok elemzéséről részletesebben [itt](https://github.com/czirkoszoltan/call-graph-generator) olvashatsz.

## Egyéb hasznos dolgok

### CG3-server

A CG3 server a webes keretrendszer a különböző tesztek futtatásához.

Fejlesztette: [Kis-Bogdán Kolos](https://pek.sch.bme.hu/profiles/kisbogdan)

[GitHub repo](https://github.com/kszi2/cg3-server)

Hibabejelentés [GitHub issue](https://github.com/kszi2/cg3-server/issues)-kon keresztül.

### CG3

Ez maga a statikus kódelemző eszköz.

Fejlesztette: [bodand](https://github.com/bodand)

[GitHub repo](https://github.com/bodand/cg3)

### Debugmalloc

Ezt remélem nem kell bemutatni.

[Eredeti verzió](https://github.com/czirkoszoltan/debugmalloc)

[Tárgyban használt verzió](https://infoc.eet.bme.hu/debugmalloc/debugmalloc.h)

### Hivási gráf generátor

Eredetileg ez lett volna a CGn (1 <= n >= 2), de jelenleg még az eredeti, Czirkos Zoltán által írt verziót használja a program. Pontosabban annak egy kicsikét módosított verzióját, hogy az include-okat is helyesen kezelje.

[GitHub repo](https://github.com/czirkoszoltan/call-graph-generator)

### Hol fut?

Jelenleg egy régi számítógépen fut, valahol a Schönherzben. Ennél több infót nem adok róla, mert a végén még valaki mérgében meg akarná szűntetni. Amúgy erősen limitált mennyiségű tárhely van a szerverben, szóval ne töltögessetek fel minden módosítás után ellenőzrésre programokat.
